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
      return Response.json({ message: 'El plan actual no incluye Kaivor AI. Mejora a Pro AI para desbloquear el análisis inteligente.', plan }, { status: 403 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const period = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const invoices = await prisma.invoice.findMany({
      where: { tenantId: jwt.tenant_id, createdAt: { gte: monthStart } },
      include: { customer: { select: { name: true } }, items: true },
    });

    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
    const pendingInvoices = invoices.filter(i => i.paymentStatus !== 'paid').length;

    // Top customers
    const custMap = new Map<string, number>();
    for (const inv of invoices) {
      const name = inv.customer?.name ?? 'Sin nombre';
      custMap.set(name, (custMap.get(name) ?? 0) + inv.total);
    }
    const topCustomers = [...custMap.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, revenue]) => ({
        name, revenue,
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      }));

    // Top product
    const prodMap = new Map<string, number>();
    for (const inv of invoices) for (const it of inv.items) {
      prodMap.set(it.description, (prodMap.get(it.description) ?? 0) + it.quantity);
    }
    const topProduct = [...prodMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sin datos';

    const summary = invoices.length === 0
      ? `Aún no has emitido facturas en ${period}. Crea tu primera factura del mes para empezar a ver análisis.`
      : `En ${period} has facturado ${fmt(totalRevenue)} con ${invoices.length} factura(s). ` +
        (pendingInvoices > 0 ? `${pendingInvoices} están pendientes de cobro — prioriza la gestión de cartera. ` : 'Toda tu cartera del mes está al día. ') +
        (topCustomers[0] ? `Tu mejor cliente es ${topCustomers[0].name} (${topCustomers[0].percentage}% de los ingresos).` : '');

    return Response.json({
      period, totalRevenue, totalInvoices: invoices.length, pendingInvoices,
      topProduct, summary, topCustomers,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
