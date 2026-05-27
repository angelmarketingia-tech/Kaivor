import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere, resolveCreateAccount } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const scope = await scopeWhere(jwt, req);
    const products = await prisma.product.findMany({
      where: { tenantId: jwt.tenant_id, isActive: true, ...scope },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(products);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    if (!company) return Response.json({ message: 'Empresa no encontrada' }, { status: 400 });
    const accountId = await resolveCreateAccount(jwt, req);
    const sku = body.sku || `SKU-${Date.now()}`;
    const product = await prisma.product.create({
      data: { tenantId: jwt.tenant_id, accountId, companyId: company.id, sku, name: body.name, category: body.category, price: Number(body.price) || 0, cost: body.cost ? Number(body.cost) : null, unit: body.unit || 'u' },
    });
    return Response.json(product, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
