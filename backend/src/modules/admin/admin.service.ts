import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// Admin = platform superadmin view across all tenants.
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const [tenants, users, invoices, subs] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.invoice.aggregate({ _sum: { total: true }, _count: true }),
      this.prisma.subscription.findMany({ select: { plan: true, status: true } }),
    ]);

    const plans: Record<string, number> = {};
    let mrr = 0;
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };
    subs.forEach((s) => {
      plans[s.plan] = (plans[s.plan] || 0) + 1;
      if (s.status === 'active') mrr += PRICES[s.plan] || 0;
    });

    return {
      tenants,
      users,
      invoices: invoices._count,
      mrr,
      plans,
      registrations: tenants,
      conversion: tenants > 0 ? Math.round(((subs.filter((s) => s.plan !== 'FREE').length) / tenants) * 100) : 0,
      pendingMemberships: subs.filter((s) => s.status === 'past_due').length,
      openErrors: 0,
      openTickets: 0,
      trafficToday: 0,
      featureUsage: [],
    };
  }

  async customers() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: { select: { email: true, name: true }, take: 1 },
        _count: { select: { users: true, companies: true } },
      },
    });
    const withSubs = await Promise.all(
      tenants.map(async (t) => {
        const sub = await this.prisma.subscription.findUnique({ where: { tenantId: t.id }, select: { plan: true, status: true } });
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: sub?.plan || 'FREE',
          status: sub?.status || 'active',
          users: t._count.users,
          companies: t._count.companies,
          owner: t.users[0]?.email || '—',
          createdAt: t.createdAt,
        };
      }),
    );
    return { customers: withSubs };
  }

  async billing() {
    const subs = await this.prisma.subscription.findMany();
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };
    let mrr = 0;
    subs.forEach((s) => { if (s.status === 'active') mrr += PRICES[s.plan] || 0; });
    return { mrr, arr: mrr * 12, activeSubscriptions: subs.filter((s) => s.status === 'active').length, subscriptions: subs };
  }

  async errors() {
    return { errors: [] };
  }

  async support() {
    return { tickets: [] };
  }

  async traffic() {
    return { trafficToday: 0, series: [] };
  }

  async automations() {
    const runs = await this.prisma.automationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return { runs };
  }

  async customerDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
        companies: true,
      },
    });
    if (!tenant) return null;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: id } });
    const [invoices, customersCount, productsCount] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { tenantId: id }, _sum: { total: true }, _count: true }),
      this.prisma.customer.count({ where: { tenantId: id } }),
      this.prisma.product.count({ where: { tenantId: id } }),
    ]);
    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, createdAt: tenant.createdAt },
      users: tenant.users,
      companies: tenant.companies,
      subscription: sub,
      stats: {
        totalRevenue: invoices._sum.total || 0,
        invoiceCount: invoices._count,
        customers: customersCount,
        products: productsCount,
      },
    };
  }
}
