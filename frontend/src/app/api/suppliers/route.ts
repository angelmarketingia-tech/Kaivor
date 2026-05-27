import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere, resolveCreateAccount } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const scope = await scopeWhere(jwt, req);
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      orderBy: { createdAt: 'desc' },
      include: { balances: { where: { status: 'pending' }, select: { amount: true } } },
    });
    return Response.json(suppliers.map(s => ({
      ...s,
      outstandingBalance: s.balances.reduce((sum, b) => sum + b.amount, 0),
      balances: undefined,
    })));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const b = await req.json();
    if (!b.name?.trim()) return Response.json({ message: 'El nombre es requerido' }, { status: 400 });
    const accountId = await resolveCreateAccount(jwt, req);
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: jwt.tenant_id,
        accountId,
        name: b.name.trim(),
        taxId: b.taxId || null,
        contactName: b.contactName || null,
        email: b.email || null,
        phone: b.phone || null,
        address: b.address || null,
        city: b.city || null,
        category: b.category || null,
        notes: b.notes || null,
      },
    });
    return Response.json(supplier, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
