import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden, recordEvent } from '@/lib/admin';

const AUTOMATIONS = [
  { id: 'inactive_companies', name: 'Empresas sin facturar', desc: 'Detecta empresas que se registraron pero no han creado facturas.' },
  { id: 'free_limit_80', name: 'Free cerca del límite', desc: 'Empresas Free que superan el 80% de su cuota mensual de facturas.' },
  { id: 'overdue_memberships', name: 'Membresías vencidas', desc: 'Cobros de membresía pendientes o vencidos.' },
  { id: 'repeated_errors', name: 'Errores recurrentes', desc: 'Mensajes de error que se repiten 3 o más veces.' },
  { id: 'unassigned_tickets', name: 'Tickets sin atender', desc: 'Tickets de soporte abiertos sin responsable.' },
  { id: 'pricing_no_convert', name: 'Vio precios sin pagar', desc: 'Empresas que visitaron precios y siguen en plan Free.' },
];

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  return Response.json({ automations: AUTOMATIONS });
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  try {
    const { id } = await req.json();
    const now = new Date();
    let matches: { label: string; detail?: string }[] = [];
    let summary = '';

    if (id === 'inactive_companies') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const tenants = await prisma.tenant.findMany({ where: { createdAt: { lt: weekAgo } } });
      for (const t of tenants) {
        const inv = await prisma.invoice.count({ where: { tenantId: t.id } });
        if (inv === 0) matches.push({ label: t.name, detail: 'sin facturas' });
      }
      summary = matches.length
        ? `${matches.length} empresa(s) sin facturar tras 7+ días. Acción sugerida: email de onboarding y tarea de soporte.`
        : 'Todas las empresas con más de 7 días ya facturaron.';
    } else if (id === 'free_limit_80') {
      const subs = await prisma.subscription.findMany({ where: { plan: 'FREE' } });
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      for (const s of subs) {
        const used = await prisma.invoice.count({ where: { tenantId: s.tenantId, createdAt: { gte: ms } } });
        if (used >= 36) {
          const t = await prisma.tenant.findUnique({ where: { id: s.tenantId } });
          matches.push({ label: t?.name ?? s.tenantId, detail: `${used}/45 facturas` });
        }
      }
      summary = matches.length
        ? `${matches.length} empresa(s) Free cerca del límite. Acción sugerida: enviar oferta de upgrade.`
        : 'Ninguna empresa Free está cerca de su límite.';
    } else if (id === 'overdue_memberships') {
      const ms = await prisma.membershipInvoice.findMany({ where: { status: { in: ['pending', 'overdue'] } } });
      for (const m of ms) {
        const overdue = new Date(m.dueDate) < now;
        const t = await prisma.tenant.findUnique({ where: { id: m.tenantId } });
        matches.push({ label: t?.name ?? m.tenantId, detail: overdue ? 'vencida' : 'pendiente' });
      }
      summary = matches.length
        ? `${matches.length} membresía(s) por cobrar. Acción sugerida: enviar recordatorio de pago.`
        : 'No hay membresías pendientes de cobro.';
    } else if (id === 'repeated_errors') {
      const errors = await prisma.errorReport.findMany({ where: { status: { in: ['open', 'investigating'] } } });
      const counts: Record<string, number> = {};
      for (const e of errors) counts[e.message] = (counts[e.message] ?? 0) + 1;
      matches = Object.entries(counts).filter(([, c]) => c >= 3).map(([m, c]) => ({ label: m.slice(0, 60), detail: `${c} veces` }));
      summary = matches.length
        ? `${matches.length} error(es) recurrente(s). Acción sugerida: crear ticket interno y notificar.`
        : 'No hay errores que se repitan 3+ veces.';
    } else if (id === 'unassigned_tickets') {
      const tickets = await prisma.supportTicket.findMany({ where: { status: 'open', assignedTo: null } });
      matches = tickets.map(t => ({ label: t.subject, detail: t.category }));
      summary = matches.length
        ? `${matches.length} ticket(s) abiertos sin responsable. Acción sugerida: asignar a soporte.`
        : 'Todos los tickets abiertos tienen responsable.';
    } else if (id === 'pricing_no_convert') {
      const events = await prisma.appEvent.findMany({ where: { eventName: 'pricing_viewed' }, distinct: ['tenantId'] });
      for (const e of events) {
        if (!e.tenantId) continue;
        const sub = await prisma.subscription.findUnique({ where: { tenantId: e.tenantId } });
        if (sub?.plan === 'FREE') {
          const t = await prisma.tenant.findUnique({ where: { id: e.tenantId } });
          matches.push({ label: t?.name ?? e.tenantId, detail: 'vio precios, sigue Free' });
        }
      }
      summary = matches.length
        ? `${matches.length} empresa(s) vieron precios sin convertir. Acción sugerida: seguimiento comercial.`
        : 'Ninguna empresa pendiente de conversión detectada.';
    } else {
      return Response.json({ message: 'Automatización no válida' }, { status: 400 });
    }

    await recordEvent('internal_automation_run', { userId: staff.id, metadata: { automation: id, matches: matches.length } });
    return Response.json({ id, summary, matchCount: matches.length, matches: matches.slice(0, 50) });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
