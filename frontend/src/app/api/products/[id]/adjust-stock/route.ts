import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const { newQuantity, reorderPoint, notes, warehouse = 'default' } = await req.json();

    const product = await prisma.product.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!product) return Response.json({ message: 'Producto no encontrado' }, { status: 404 });

    const qty = Math.max(0, Math.round(Number(newQuantity) || 0));
    const reorder = reorderPoint != null ? Math.max(0, Math.round(Number(reorderPoint))) : null;

    let inv = await prisma.inventory.findFirst({
      where: { productId: id, tenantId: jwt.tenant_id, warehouse },
    });

    let previous = 0;
    if (inv) {
      previous = Number(inv.quantity);
      inv = await prisma.inventory.update({
        where: { id: inv.id },
        data: { quantity: BigInt(qty), ...(reorder != null ? { reorderPoint: BigInt(reorder) } : {}) },
      });
    } else {
      inv = await prisma.inventory.create({
        data: {
          tenantId: jwt.tenant_id, accountId: product.accountId, productId: id, warehouse,
          quantity: BigInt(qty), reorderPoint: BigInt(reorder ?? 10),
        },
      });
    }

    // Record the movement (delta)
    const delta = qty - previous;
    await prisma.inventoryMovement.create({
      data: {
        tenantId: jwt.tenant_id, inventoryId: inv.id,
        type: 'adjustment', quantity: BigInt(delta),
        notes: notes || `Ajuste manual: ${previous} → ${qty}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id, userId: jwt.sub,
        action: 'updated', resourceType: 'inventory', resourceId: id,
        changes: { previous, newQuantity: qty, delta },
      },
    });

    return Response.json({
      id: inv.id, warehouse: inv.warehouse,
      quantity: Number(inv.quantity), reorderPoint: Number(inv.reorderPoint),
      delta,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
