import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { recordEvent } from '@/lib/admin';
import { scopeWhere, resolveCreateAccount } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const scope = await scopeWhere(jwt, req);
    const customers = await prisma.customer.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(customers);
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
    const customer = await prisma.customer.create({
      data: { tenantId: jwt.tenant_id, accountId, companyId: company.id, name: body.name, email: body.email, phone: body.phone, taxId: body.taxId, address: body.address },
    });
    await recordEvent('customer_created', { tenantId: jwt.tenant_id, userId: jwt.sub });
    return Response.json(customer, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
