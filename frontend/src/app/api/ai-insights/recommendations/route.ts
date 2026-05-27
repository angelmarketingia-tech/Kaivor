import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const PREMIUM = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'];
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    if (!PREMIUM.includes(plan)) {
      return Response.json({ message: 'El plan actual no incluye Kaivor AI.', plan, recommendations: [] }, { status: 403 });
    }

    const tid = jwt.tenant_id;
    const now = new Date();
    const recommendations: { type: string; title: string; body: string; priority: string }[] = [];

    // Overdue invoices
    const overdue = await prisma.invoice.findMany({
      where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } },
    });
    if (overdue.length > 0) {
      const totalDue = overdue.reduce((s, i) => s + i.total, 0);
      recommendations.push({
        type: 'collections', priority: 'high',
        title: `${overdue.length} factura(s) vencida(s)`,
        body: `Tienes ${fmt(totalDue)} pendiente de cobro. Envía recordatorios por WhatsApp a estos clientes para recuperar tu cartera.`,
      });
    }

    // Low / out of stock
    const inv = await prisma.inventory.findMany({ where: { tenantId: tid } });
    const low = inv.filter(i => Number(i.quantity) <= Number(i.reorderPoint));
    const out = inv.filter(i => Number(i.quantity) <= 0);
    if (out.length > 0) {
      recommendations.push({
        type: 'inventory', priority: 'high',
        title: `${out.length} producto(s) sin stock`,
        body: 'Hay productos agotados que no podrás vender. Registra una entrada de inventario lo antes posible.',
      });
    } else if (low.length > 0) {
      recommendations.push({
        type: 'inventory', priority: 'medium',
        title: `${low.length} producto(s) con stock bajo`,
        body: 'Algunos productos están cerca de agotarse. Considera reponerlos para no perder ventas.',
      });
    }

    // Inactive customers
    const customers = await prisma.customer.findMany({
      where: { tenantId: tid }, include: { invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const inactive = customers.filter(c => {
      const last = c.invoices[0]?.createdAt;
      return last && (now.getTime() - new Date(last).getTime()) / 86400000 > 45;
    });
    if (inactive.length > 0) {
      recommendations.push({
        type: 'crm', priority: 'medium',
        title: `${inactive.length} cliente(s) inactivo(s)`,
        body: `Llevan más de 45 días sin comprar. Una campaña de recompra por WhatsApp puede reactivarlos.`,
      });
    }

    // Setup nudges
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = await prisma.invoice.count({ where: { tenantId: tid, createdAt: { gte: monthStart } } });
    if (monthCount === 0) {
      recommendations.push({
        type: 'sales', priority: 'medium',
        title: 'Sin ventas este mes',
        body: 'Aún no has emitido facturas este mes. Crea tu primera factura para empezar a registrar ingresos.',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'positive', priority: 'positive',
        title: 'Todo en orden',
        body: 'No detectamos riesgos en tu operación: cartera al día, inventario sano y clientes activos. ¡Buen trabajo!',
      });
    }

    return Response.json({ recommendations, generatedAt: now.toISOString() });
  } catch (err: any) {
    return Response.json({ message: err.message, recommendations: [] }, { status: 500 });
  }
}
