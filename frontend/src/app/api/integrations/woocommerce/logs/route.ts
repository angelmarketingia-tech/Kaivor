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
    if (!integration) return Response.json([]);
    const logs = await prisma.integrationLog.findMany({
      where: { integrationId: integration.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return Response.json(logs);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
