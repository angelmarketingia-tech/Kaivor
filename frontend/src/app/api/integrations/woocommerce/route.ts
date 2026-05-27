import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const integration = await prisma.integration.findFirst({
      where: { tenantId: jwt.tenant_id, provider: 'woocommerce' },
    });
    return Response.json(integration ?? { status: 'not_connected' });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { storeUrl } = await req.json();
    if (!storeUrl) return Response.json({ message: 'storeUrl requerido' }, { status: 400 });
    const integration = await prisma.integration.upsert({
      where: { id: `woo-${jwt.tenant_id}` },
      update: { storeUrl, status: 'connected', updatedAt: new Date() },
      create: { tenantId: jwt.tenant_id, provider: 'woocommerce', storeUrl, status: 'connected' },
    });
    return Response.json(integration);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
