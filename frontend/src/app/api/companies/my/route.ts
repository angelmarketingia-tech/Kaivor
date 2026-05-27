import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    return Response.json(company ?? {});
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    if (!company) return Response.json({ message: 'Empresa no encontrada' }, { status: 404 });
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { name: body.name, taxId: body.taxId ?? company.taxId, phone: body.phone, email: body.email, address: body.address },
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
