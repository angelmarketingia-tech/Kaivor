import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    return Response.json({
      plan: sub?.plan ?? 'FREE',
      status: sub?.status ?? 'active',
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
