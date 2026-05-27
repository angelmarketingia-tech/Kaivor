import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { getSmtpConfig, sendEmail } from '@/lib/email';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: jwt.tenant_id },
      include: { customer: true, company: true, items: true },
    });
    if (!invoice) return Response.json({ message: 'Factura no encontrada' }, { status: 404 });

    const to = invoice.customer?.email;
    if (!to) {
      return Response.json({ message: 'El cliente no tiene email registrado. Agrégalo para enviar la factura.' }, { status: 400 });
    }

    const cfg = await getSmtpConfig(jwt.tenant_id);
    if (!cfg) {
      return Response.json({
        message: 'Configura tu correo para enviar facturas y recordatorios desde Kaivor.',
        needsConfig: true,
      }, { status: 400 });
    }

    const rows = invoice.items.map(i =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${i.description}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${i.quantity}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${fmt(i.total)}</td></tr>`
    ).join('');

    const html = `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto">
      <h2 style="color:#7c3aed">${invoice.company.name}</h2>
      <p>Estimado/a <strong>${invoice.customer.name}</strong>,</p>
      <p>Adjuntamos los detalles de tu factura <strong>${invoice.invoiceNumber}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b">Descripción</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b">Cant</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:18px;font-weight:bold">TOTAL: ${fmt(invoice.total)}</p>
      <p style="color:#64748b;font-size:13px">Gracias por tu compra.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0">
      <p style="font-size:11px;color:#94a3b8">Factura emitida desde Kaivor</p>
    </div>`;

    try {
      await sendEmail(cfg, to, `Factura ${invoice.invoiceNumber} — ${invoice.company.name}`, html);
    } catch (sendErr: any) {
      await prisma.messageLog.create({
        data: {
          tenantId: jwt.tenant_id, customerId: invoice.customerId, invoiceId: id,
          channel: 'email', destination: to, subject: `Factura ${invoice.invoiceNumber}`,
          message: 'Envío de factura por email', status: 'failed', provider: 'smtp', error: sendErr.message,
        },
      });
      return Response.json({ message: `Error al enviar: ${sendErr.message}` }, { status: 500 });
    }

    await prisma.invoiceDeliveryLog.create({
      data: { tenantId: jwt.tenant_id, invoiceId: id, channel: 'email', status: 'sent', destination: to, message: `Factura ${invoice.invoiceNumber}` },
    });
    await prisma.messageLog.create({
      data: {
        tenantId: jwt.tenant_id, customerId: invoice.customerId, invoiceId: id,
        channel: 'email', destination: to, subject: `Factura ${invoice.invoiceNumber}`,
        message: 'Envío de factura por email', status: 'sent', provider: 'smtp',
      },
    });
    await prisma.auditLog.create({
      data: { tenantId: jwt.tenant_id, userId: jwt.sub, action: 'sent', resourceType: 'invoice', resourceId: id, changes: { channel: 'email', to } },
    });

    return Response.json({ ok: true, sentTo: to });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
