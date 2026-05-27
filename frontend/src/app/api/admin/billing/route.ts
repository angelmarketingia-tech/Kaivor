import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden } from '@/lib/admin';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  try {
    const memberships = await prisma.membershipInvoice.findMany({
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    // Mark overdue on the fly
    const now = new Date();
    const rows = [];
    for (const m of memberships) {
      let status = m.status;
      if (status === 'pending' && new Date(m.dueDate) < now) status = 'overdue';
      const tenant = await prisma.tenant.findUnique({ where: { id: m.tenantId }, select: { name: true } });
      rows.push({ ...m, status, tenantName: tenant?.name ?? '—' });
    }
    return Response.json({
      memberships: rows,
      summary: {
        pending: rows.filter(r => r.status === 'pending').length,
        overdue: rows.filter(r => r.status === 'overdue').length,
        paid: rows.filter(r => r.status === 'paid').length,
        totalPending: rows.filter(r => r.status !== 'paid' && r.status !== 'cancelled').reduce((s, r) => s + r.amount, 0),
      },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// POST creates a membership invoice
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt, ['platform_superadmin', 'platform_admin', 'platform_billing']);
  if (!staff) return adminForbidden();
  try {
    const { tenantId, plan, amount, dueDate, notes } = await req.json();
    if (!tenantId || !plan || !amount) {
      return Response.json({ message: 'Empresa, plan y monto son requeridos' }, { status: 400 });
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return Response.json({ message: 'Empresa no encontrada' }, { status: 404 });
    const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000);
    const membership = await prisma.membershipInvoice.create({
      data: { tenantId, plan, amount: Number(amount), dueDate: due, notes: notes || null },
    });
    return Response.json(membership, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH: mark-paid / cancel / send-reminder
export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt, ['platform_superadmin', 'platform_admin', 'platform_billing']);
  if (!staff) return adminForbidden();
  try {
    const { id, action } = await req.json();
    const membership = await prisma.membershipInvoice.findUnique({ where: { id } });
    if (!membership) return Response.json({ message: 'Cobro no encontrado' }, { status: 404 });

    if (action === 'mark-paid') {
      const updated = await prisma.membershipInvoice.update({
        where: { id }, data: { status: 'paid', paidAt: new Date() },
      });
      return Response.json(updated);
    }
    if (action === 'cancel') {
      const updated = await prisma.membershipInvoice.update({ where: { id }, data: { status: 'cancelled' } });
      return Response.json(updated);
    }
    if (action === 'send-reminder') {
      const company = await prisma.company.findFirst({ where: { tenantId: membership.tenantId } });
      const phone = company?.phone?.replace(/\D/g, '');
      const message = `Hola, te recordamos que tu membresía Kaivor (plan ${membership.plan}) por ${fmt(membership.amount)} está pendiente de pago. Gracias.`;
      if (!phone) {
        return Response.json({ noPhone: true, message: 'La empresa no tiene teléfono registrado. Contáctala por otro medio.' });
      }
      const formatted = phone.startsWith('57') ? phone : `57${phone}`;
      const waUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
      await prisma.messageLog.create({
        data: {
          tenantId: membership.tenantId, channel: 'whatsapp', destination: formatted,
          message, status: 'manual_opened', provider: 'wa.me',
        },
      }).catch(() => {});
      return Response.json({ waUrl });
    }
    return Response.json({ message: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
