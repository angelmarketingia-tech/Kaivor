import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { plan } = await req.json();
    const validPlans = ['FREE','STARTER','PRO_AI','BUSINESS','ENTERPRISE'];
    if (!validPlans.includes(plan)) {
      return Response.json({ message: 'Plan inválido' }, { status: 400 });
    }
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const sub = await prisma.subscription.upsert({
      where: { tenantId: jwt.tenant_id },
      update: { plan, currentPeriodStart: now, currentPeriodEnd: periodEnd },
      create: { tenantId: jwt.tenant_id, plan, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd },
    });
    return Response.json({ plan: sub.plan, status: sub.status });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
