import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden } from '@/lib/admin';

const PLAN_PRICE: Record<string, number> = { FREE: 0, STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();

  try {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants, activeTenants, totalUsers, totalInvoices, monthInvoices,
      newToday, newMonth, subscriptions, openErrors, openTickets,
      pendingMemberships, eventsToday, regToFirstInvoice,
    ] = [
      await prisma.tenant.count(),
      await prisma.tenant.count({ where: { isActive: true } }),
      await prisma.user.count(),
      await prisma.invoice.count(),
      await prisma.invoice.count({ where: { createdAt: { gte: monthStart } } }),
      await prisma.tenant.count({ where: { createdAt: { gte: dayStart } } }),
      await prisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
      await prisma.subscription.findMany({ select: { plan: true } }),
      await prisma.errorReport.count({ where: { status: { in: ['open', 'investigating'] } } }),
      await prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      await prisma.membershipInvoice.count({ where: { status: { in: ['pending', 'overdue'] } } }),
      await prisma.appEvent.count({ where: { createdAt: { gte: dayStart } } }),
      await prisma.appEvent.count({ where: { eventName: 'login', createdAt: { gte: weekAgo } } }),
    ];

    const planCounts: Record<string, number> = { FREE: 0, STARTER: 0, PRO_AI: 0, BUSINESS: 0, ENTERPRISE: 0 };
    let mrr = 0;
    for (const s of subscriptions) {
      planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;
      mrr += PLAN_PRICE[s.plan] ?? 0;
    }

    // Feature usage
    const [waUse, aiUse, invUse, custUse] = [
      await prisma.messageLog.count({ where: { channel: 'whatsapp' } }),
      await prisma.agentConversation.count(),
      await prisma.inventory.count(),
      await prisma.customer.count(),
    ];

    // Conversion: tenants that created at least 1 invoice
    const tenantsWithInvoice = await prisma.invoice.findMany({ distinct: ['tenantId'], select: { tenantId: true } });
    const conversionFirstInvoice = totalTenants > 0
      ? Math.round((tenantsWithInvoice.length / totalTenants) * 100) : 0;
    const paidTenants = subscriptions.filter(s => s.plan !== 'FREE').length;
    const conversionPaid = totalTenants > 0 ? Math.round((paidTenants / totalTenants) * 100) : 0;

    return Response.json({
      tenants: { total: totalTenants, active: activeTenants, inactive: totalTenants - activeTenants },
      users: { total: totalUsers, activeWeek: regToFirstInvoice },
      registrations: { today: newToday, month: newMonth },
      invoices: { total: totalInvoices, month: monthInvoices },
      plans: planCounts,
      mrr,
      pendingMemberships,
      openErrors,
      openTickets,
      trafficToday: eventsToday,
      conversion: { firstInvoice: conversionFirstInvoice, paid: conversionPaid },
      featureUsage: { whatsapp: waUse, ai: aiUse, inventory: invUse, crm: custUse },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
