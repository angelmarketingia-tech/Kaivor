import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const LIMITS: Record<string, number> = {
  FREE: 45, STARTER: 150, PRO_AI: 500, BUSINESS: -1, ENTERPRISE: -1,
};

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    const now = new Date();
    const periodStart = sub?.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);

    const invoiceCount = await prisma.invoice.count({
      where: { tenantId: jwt.tenant_id, createdAt: { gte: periodStart } },
    });
    const limit = LIMITS[plan] ?? 45;
    const remaining = limit === -1 ? 9999 : Math.max(0, limit - invoiceCount);
    const percentage = limit === -1 ? 0 : Math.min(100, Math.round((invoiceCount / limit) * 100));
    const isPremium = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);
    return Response.json({
      plan,
      invoices: { used: invoiceCount, limit: limit === -1 ? 999999 : limit, remaining, percentage },
      features: { aiInsights: isPremium, woocommerce: isPremium, usersMax: isPremium ? 50 : 3 },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
