import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from "@/lib/account-scope";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const product = await prisma.product.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!product) return Response.json({ message: 'Producto no encontrado' }, { status: 404 });

    const inventory = await prisma.inventory.findMany({
      where: { productId: id, tenantId: jwt.tenant_id },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });

    const salesItems = await prisma.invoiceItem.findMany({
      where: { productId: id, tenantId: jwt.tenant_id },
    });

    const totalStock = inventory.reduce((s, inv) => s + Number(inv.quantity), 0);
    const reorderPoint = inventory.length ? Number(inventory[0].reorderPoint) : 10;
    let stockStatus: 'in_stock' | 'low' | 'out';
    if (totalStock <= 0) stockStatus = 'out';
    else if (totalStock <= reorderPoint) stockStatus = 'low';
    else stockStatus = 'in_stock';

    const totalSold = salesItems.reduce((s, it) => s + it.quantity, 0);
    const totalRevenue = salesItems.reduce((s, it) => s + it.total, 0);

    return Response.json({
      product,
      inventory: inventory.map(inv => ({
        id: inv.id, warehouse: inv.warehouse,
        quantity: Number(inv.quantity), reorderPoint: Number(inv.reorderPoint),
        movements: inv.movements.map(m => ({
          id: m.id, type: m.type, quantity: Number(m.quantity),
          reference: m.reference, notes: m.notes, createdAt: m.createdAt,
        })),
      })),
      stats: {
        totalStock, reorderPoint, stockStatus,
        totalSold, totalRevenue,
        timesInvoiced: salesItems.length,
      },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const existing = await prisma.product.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!existing) return Response.json({ message: 'Producto no encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ['name', 'category', 'unit', 'barcode']) if (f in body) data[f] = body[f];
    if ('price' in body) data.price = Number(body.price) || 0;
    if ('cost' in body) data.cost = body.cost ? Number(body.cost) : null;

    const product = await prisma.product.update({ where: { id }, data });
    return Response.json(product);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
