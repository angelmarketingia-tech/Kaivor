import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from "@/lib/account-scope";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!supplier) return Response.json({ message: 'Proveedor no encontrado' }, { status: 404 });
    const balances = await prisma.supplierBalance.findMany({
      where: { supplierId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });
    const outstanding = balances.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);
    return Response.json({ supplier, balances, outstanding });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH actions: update-supplier, add-balance, mark-balance
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!supplier) return Response.json({ message: 'Proveedor no encontrado' }, { status: 404 });
    const b = await req.json();

    if (b.action === 'update-supplier') {
      const data: Record<string, any> = {};
      for (const f of ['name', 'taxId', 'contactName', 'email', 'phone', 'address', 'city', 'category', 'status', 'notes']) {
        if (f in b) data[f] = b[f];
      }
      const updated = await prisma.supplier.update({ where: { id }, data });
      return Response.json(updated);
    }

    if (b.action === 'add-balance') {
      if (!b.amount) return Response.json({ message: 'El monto es requerido' }, { status: 400 });
      const balance = await prisma.supplierBalance.create({
        data: {
          tenantId: jwt.tenant_id, supplierId: id,
          description: b.description || null, amount: Number(b.amount),
          dueDate: b.dueDate ? new Date(b.dueDate) : null,
        },
      });
      return Response.json(balance, { status: 201 });
    }

    if (b.action === 'mark-balance') {
      const bal = await prisma.supplierBalance.findFirst({ where: { id: b.balanceId, supplierId: id } });
      if (!bal) return Response.json({ message: 'Saldo no encontrado' }, { status: 404 });
      const updated = await prisma.supplierBalance.update({
        where: { id: b.balanceId },
        data: { status: ['pending', 'paid', 'cancelled'].includes(b.status) ? b.status : bal.status },
      });
      return Response.json(updated);
    }

    return Response.json({ message: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
