import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const scope = await scopeWhere(jwt, req);
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: jwt.tenant_id, createdAt: { gte: monthStart }, ...scope },
      select: { total: true, status: true },
    });
    const total = invoices.reduce((s, i) => s + i.total, 0);
    const pending = invoices.filter((i) => i.status === 'pending').length;
    return Response.json({
      totalInvoices: invoices.length,
      totalRevenue: total,
      pendingInvoices: pending,
      month: monthStart,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
