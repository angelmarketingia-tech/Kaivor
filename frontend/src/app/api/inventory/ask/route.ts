import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { question } = await req.json();
    const q = String(question || '').toLowerCase();

    // Plan gating
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    const isPremium = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);
    if (!isPremium) {
      return Response.json({
        answer: 'Las consultas inteligentes de inventario están disponibles en los planes Pro AI, Business y Enterprise. Con ellas puedes preguntar en lenguaje natural qué reponer, qué está por agotarse y qué se vende más.',
        teaser: true, plan,
      });
    }

    // Load inventory data
    const inventories = await prisma.inventory.findMany({
      where: { tenantId: jwt.tenant_id },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });
    const withQty = inventories.map(inv => ({
      name: inv.product.name, sku: inv.product.sku, productId: inv.product.id,
      qty: Number(inv.quantity), reorder: Number(inv.reorderPoint),
    }));
    const lowStock = withQty.filter(i => i.qty > 0 && i.qty <= i.reorder);
    const outOfStock = withQty.filter(i => i.qty <= 0);

    let answer = '';
    const data: any = {};

    if (/sin stock|agotad|sin existencia/.test(q)) {
      data.products = outOfStock;
      answer = outOfStock.length
        ? `Tienes ${outOfStock.length} producto(s) sin stock: ${outOfStock.map(p => p.name).join(', ')}. Te recomiendo registrar una entrada de inventario pronto.`
        : 'Buenas noticias: ningún producto está sin stock en este momento.';
    } else if (/bajo|reponer|reposici|repon/.test(q)) {
      data.products = lowStock;
      answer = lowStock.length
        ? `Hay ${lowStock.length} producto(s) con stock bajo. Los más urgentes: ${lowStock.slice(0, 3).map(p => `${p.name} (${p.qty} unidades)`).join(', ')}. Considera reponerlos para no perder ventas.`
        : 'Ningún producto está por debajo de su punto de reorden. Tu inventario está sano.';
    } else if (/vence|vencimiento|caduca|lote/.test(q)) {
      answer = 'El seguimiento de lotes y fechas de vencimiento estará disponible en una próxima actualización. Por ahora puedo ayudarte con stock bajo, productos agotados y los más vendidos.';
    } else if (/vendid|más vende|mas vende|rotaci/.test(q)) {
      const items = await prisma.invoiceItem.findMany({ where: { tenantId: jwt.tenant_id } });
      const map = new Map<string, number>();
      for (const it of items) map.set(it.description, (map.get(it.description) ?? 0) + it.quantity);
      const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      data.topProducts = top.map(([name, qty]) => ({ name, qty }));
      answer = top.length
        ? `Tus productos más vendidos: ${top.map(([name, qty]) => `${name} (${qty} unidades)`).join(', ')}.`
        : 'Aún no hay ventas registradas para calcular los productos más vendidos.';
    } else {
      // General summary
      const totalUnits = withQty.reduce((s, i) => s + i.qty, 0);
      answer = `Resumen de inventario: ${withQty.length} producto(s) con seguimiento, ${totalUnits} unidades en total. ` +
        (outOfStock.length ? `${outOfStock.length} sin stock. ` : '') +
        (lowStock.length ? `${lowStock.length} con stock bajo: ${lowStock.slice(0, 3).map(p => p.name).join(', ')}.` : 'Todos los productos tienen stock suficiente.');
      data.lowStock = lowStock; data.outOfStock = outOfStock;
    }

    // Log as audit
    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id, userId: jwt.sub,
        action: 'viewed', resourceType: 'inventory_ai', resourceId: null,
        changes: { question: q.slice(0, 200) },
      },
    }).catch(() => {});

    return Response.json({ answer, data, teaser: false });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
