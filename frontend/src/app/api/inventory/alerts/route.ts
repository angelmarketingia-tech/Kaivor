import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const scope = await scopeWhere(jwt, req);
    const inventories = await prisma.inventory.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    const alerts: any[] = [];
    for (const inv of inventories) {
      const qty = Number(inv.quantity);
      const reorder = Number(inv.reorderPoint);
      if (qty <= 0) {
        alerts.push({
          type: 'out_of_stock', severity: 'high',
          productId: inv.product.id, productName: inv.product.name, sku: inv.product.sku,
          quantity: qty, reorderPoint: reorder,
          message: `${inv.product.name} está sin stock.`,
        });
      } else if (qty <= reorder) {
        alerts.push({
          type: 'low_stock', severity: 'medium',
          productId: inv.product.id, productName: inv.product.name, sku: inv.product.sku,
          quantity: qty, reorderPoint: reorder,
          message: `${inv.product.name} tiene stock bajo (${qty} ≤ ${reorder}).`,
        });
      }
    }

    alerts.sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1));
    return Response.json({
      alerts,
      summary: {
        total: alerts.length,
        outOfStock: alerts.filter(a => a.type === 'out_of_stock').length,
        lowStock: alerts.filter(a => a.type === 'low_stock').length,
        trackedProducts: inventories.length,
      },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
