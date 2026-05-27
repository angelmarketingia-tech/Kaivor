import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { checkHrPlan, hrLocked } from '@/lib/hr';
import { getSmtpConfig, sendEmail } from '@/lib/email';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function receiptHtml(opts: {
  company: any; branding: any; period: any; item: any; employee: any;
}): string {
  const { company, branding, period, item, employee } = opts;
  const color = branding?.primaryColor || '#7c3aed';
  const logo = branding?.logoData && branding?.showLogoOnPdf
    ? `<img src="${branding.logoData}" style="max-height:48px;margin-bottom:8px" />` : '';
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    <div style="background:${color};color:#fff;padding:16px 20px">
      ${logo}
      <div style="font-size:16px;font-weight:700">${company?.name ?? 'Empresa'}</div>
      <div style="font-size:11px;opacity:0.9">NIT: ${company?.taxId ?? '—'}</div>
    </div>
    <div style="padding:20px">
      <h2 style="font-size:15px;margin:0 0 4px">Comprobante de nómina</h2>
      <p style="font-size:12px;color:#64748b;margin:0 0 14px">Periodo: ${period.name}</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#64748b">Empleado</td><td style="text-align:right;font-weight:600">${employee.firstName} ${employee.lastName}</td></tr>
        ${employee.documentNumber ? `<tr><td style="padding:4px 0;color:#64748b">Documento</td><td style="text-align:right">${employee.documentNumber}</td></tr>` : ''}
        ${employee.position ? `<tr><td style="padding:4px 0;color:#64748b">Cargo</td><td style="text-align:right">${employee.position}</td></tr>` : ''}
        <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:8px"></td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Salario base</td><td style="text-align:right">${fmt(item.baseSalary)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Ingresos / bonificaciones</td><td style="text-align:right;color:#16a34a">+${fmt(item.earnings)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Deducciones</td><td style="text-align:right;color:#dc2626">-${fmt(item.deductions)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;border-top:2px solid #e2e8f0">Neto a pagar</td><td style="text-align:right;font-weight:700;font-size:16px;border-top:2px solid #e2e8f0;color:${color}">${fmt(item.netPay)}</td></tr>
      </table>
      <p style="font-size:12px;color:#64748b;margin-top:12px">
        Estado: ${item.status === 'paid' ? 'Pagado' : 'Pendiente'}${period.paymentDate ? ` · Fecha de pago: ${new Date(period.paymentDate).toLocaleDateString('es-CO')}` : ''}
      </p>
      ${item.notes ? `<p style="font-size:12px;color:#64748b">Observaciones: ${item.notes}</p>` : ''}
      ${branding?.legalNote ? `<p style="font-size:10px;color:#94a3b8;margin-top:10px">${branding.legalNote}</p>` : ''}
      <p style="font-size:10px;color:#94a3b8;margin-top:10px;border-top:1px solid #e2e8f0;padding-top:8px">
        Comprobante operativo generado por Kaivor. Valida la información con tu responsable contable o laboral.
      </p>
    </div>
  </div>`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);

  try {
    const { id } = await params;
    const { itemId, channel } = await req.json();

    const period = await prisma.payrollPeriod.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!period) return Response.json({ message: 'Periodo no encontrado' }, { status: 404 });
    const item = await prisma.payrollItem.findFirst({ where: { id: itemId, payrollPeriodId: id } });
    if (!item) return Response.json({ message: 'Ítem de nómina no encontrado' }, { status: 404 });
    const employee = await prisma.employee.findFirst({ where: { id: item.employeeId, tenantId: jwt.tenant_id } });
    if (!employee) return Response.json({ message: 'Empleado no encontrado' }, { status: 404 });
    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    const branding = await prisma.companyBranding.findUnique({ where: { tenantId: jwt.tenant_id } });

    if (channel === 'email') {
      if (!employee.email) {
        return Response.json({ message: 'El empleado no tiene email registrado.', needsContact: true }, { status: 400 });
      }
      const cfg = await getSmtpConfig(jwt.tenant_id);
      if (!cfg) {
        return Response.json({ message: 'Configura tu correo para enviar comprobantes de nómina.', needsConfig: true }, { status: 400 });
      }
      const html = receiptHtml({ company, branding, period, item, employee });
      try {
        await sendEmail(cfg, employee.email, `Comprobante de nómina — ${period.name}`, html);
        await prisma.messageLog.create({
          data: {
            tenantId: jwt.tenant_id, channel: 'email', destination: employee.email,
            subject: `Comprobante de nómina — ${period.name}`,
            message: `Comprobante de nómina de ${employee.firstName} ${employee.lastName}`,
            status: 'sent', provider: 'smtp',
          },
        });
        await prisma.auditLog.create({
          data: { tenantId: jwt.tenant_id, userId: jwt.sub, action: 'sent', resourceType: 'payroll_receipt', resourceId: itemId, changes: { channel: 'email' } },
        }).catch(() => {});
        return Response.json({ ok: true, message: 'Comprobante enviado por email.' });
      } catch (sendErr: any) {
        await prisma.messageLog.create({
          data: {
            tenantId: jwt.tenant_id, channel: 'email', destination: employee.email,
            message: `Comprobante de nómina de ${employee.firstName} ${employee.lastName}`,
            status: 'failed', provider: 'smtp', error: sendErr.message,
          },
        }).catch(() => {});
        return Response.json({ message: `Error al enviar: ${sendErr.message}` }, { status: 500 });
      }
    }

    if (channel === 'whatsapp') {
      const phone = employee.phone?.replace(/\D/g, '');
      if (!phone) {
        return Response.json({ message: 'El empleado no tiene teléfono. Agrégalo para enviar por WhatsApp.', needsContact: true }, { status: 400 });
      }
      const formatted = phone.startsWith('57') ? phone : `57${phone}`;
      const message = `Hola ${employee.firstName}, te compartimos tu comprobante de nómina del periodo ${period.name}. Neto a pagar: ${fmt(item.netPay)}. Cualquier duda, contáctanos.`;
      const waUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
      await prisma.messageLog.create({
        data: {
          tenantId: jwt.tenant_id, channel: 'whatsapp', destination: formatted,
          message, status: 'manual_opened', provider: 'wa.me',
        },
      });
      await prisma.auditLog.create({
        data: { tenantId: jwt.tenant_id, userId: jwt.sub, action: 'sent', resourceType: 'payroll_receipt', resourceId: itemId, changes: { channel: 'whatsapp' } },
      }).catch(() => {});
      return Response.json({ ok: true, waUrl, message: 'WhatsApp abierto con el comprobante.' });
    }

    return Response.json({ message: 'Canal no válido' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
