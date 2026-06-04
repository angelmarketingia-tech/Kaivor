import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// Admin = platform superadmin view across all tenants.
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      tenantsTotal,
      tenantsActive,
      usersTotal,
      regToday,
      regMonth,
      invTotal,
      invMonth,
      subs,
      openTickets,
      waMessages,
      waEnabledTenants,
      productsTotal,
      customersTotal,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.tenant.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.subscription.findMany({ select: { plan: true, status: true } }),
      this.prisma.supportTicket.count({ where: { status: 'open' } }).catch(() => 0),
      this.prisma.whatsappMessage.count().catch(() => 0),
      this.prisma.whatsappAgentConfig.count({ where: { enabled: true } }).catch(() => 0),
      this.prisma.product.count().catch(() => 0),
      this.prisma.customer.count().catch(() => 0),
    ]);

    const plans: Record<string, number> = { FREE: 0, STARTER: 0, PRO_AI: 0, BUSINESS: 0, ENTERPRISE: 0 };
    let mrr = 0;
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };
    subs.forEach((s) => {
      plans[s.plan] = (plans[s.plan] || 0) + 1;
      if (s.status === 'active') mrr += PRICES[s.plan] || 0;
    });

    // Conversion: % of tenants that have issued at least one invoice, and % on a paid plan.
    const tenantsWithInvoice = await this.prisma.invoice
      .findMany({ distinct: ['tenantId'], select: { tenantId: true } })
      .then((rows) => rows.length)
      .catch(() => 0);
    const paidCount = subs.filter((s) => s.plan !== 'FREE').length;

    // AI/agent usage proxy: count of AppEvents of AI type + assistant.
    const aiUsage = await this.prisma.appEvent
      .count({ where: { type: { in: ['ai_query', 'assistant_ask', 'agent_ask', 'inventory_ask', 'hr_ai'] } } })
      .catch(() => 0);

    return {
      tenants: { total: tenantsTotal, active: tenantsActive, inactive: tenantsTotal - tenantsActive },
      users: { total: usersTotal },
      registrations: { today: regToday, month: regMonth },
      invoices: { total: invTotal, month: invMonth },
      mrr,
      plans,
      conversion: {
        firstInvoice: tenantsTotal > 0 ? Math.round((tenantsWithInvoice / tenantsTotal) * 100) : 0,
        paid: tenantsTotal > 0 ? Math.round((paidCount / tenantsTotal) * 100) : 0,
      },
      pendingMemberships: subs.filter((s) => s.status === 'past_due').length,
      openErrors: 0,
      openTickets,
      trafficToday: regToday,
      featureUsage: {
        whatsapp: waMessages,
        whatsappActiveTenants: waEnabledTenants,
        ai: aiUsage,
        inventory: productsTotal,
        crm: customersTotal,
      },
    };
  }

  async customers() {
    // Avoid N+1: fetch tenants, all subscriptions, and invoice counts grouped by tenant in 3 queries total.
    const [tenants, subs, invoiceGroups] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: { users: { select: { email: true }, take: 1 }, _count: { select: { users: true } } },
      }),
      this.prisma.subscription.findMany({ select: { tenantId: true, plan: true, status: true } }),
      this.prisma.invoice.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    ]);
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
    const invByTenant = new Map(invoiceGroups.map((g) => [g.tenantId, g._count._all]));

    // Frontend reads a flat array of rows with {id,name,slug,isActive,plan,subStatus,users,invoices,createdAt}.
    return tenants.map((t) => {
      const sub = subByTenant.get(t.id);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        isActive: t.isActive,
        plan: sub?.plan || 'FREE',
        subStatus: sub?.status || 'active',
        users: t._count.users,
        invoices: invByTenant.get(t.id) || 0,
        owner: t.users[0]?.email || '—',
        createdAt: t.createdAt,
      };
    });
  }

  async billing() {
    const subs = await this.prisma.subscription.findMany();
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49000, PRO_AI: 99000, BUSINESS: 199000, ENTERPRISE: 499000 };
    let mrr = 0;
    subs.forEach((s) => { if (s.status === 'active') mrr += PRICES[s.plan] || 0; });

    // Build the membership rows + summary the frontend reads.
    const tenantNames = await this.prisma.tenant.findMany({ select: { id: true, name: true } });
    const nameById = new Map(tenantNames.map((t) => [t.id, t.name]));
    const memberships = subs
      .filter((s) => s.plan !== 'FREE')
      .map((s) => ({
        id: s.id,
        tenantName: nameById.get(s.tenantId) || s.tenantId,
        plan: s.plan,
        dueDate: s.currentPeriodEnd,
        amount: PRICES[s.plan] || 0,
        status: s.status,
      }));
    const summary = {
      paid: subs.filter((s) => s.status === 'active' && s.plan !== 'FREE').length,
      pending: subs.filter((s) => s.status === 'trialing').length,
      overdue: subs.filter((s) => s.status === 'past_due').length,
      totalPending: subs.filter((s) => s.status === 'past_due').reduce((sum, s) => sum + (PRICES[s.plan] || 0), 0),
    };
    return { mrr, arr: mrr * 12, activeSubscriptions: subs.filter((s) => s.status === 'active').length, summary, memberships };
  }

  async errors() {
    // No error-tracking table yet; return the shape the frontend reads so the page renders cleanly.
    return { errors: [], counts: { open: 0, investigating: 0, resolved: 0 } };
  }

  async support(status?: string) {
    const valid = ['open', 'in_progress', 'resolved', 'closed'];
    const where = status && status !== 'all' && valid.includes(status) ? { status } : {};
    const [tickets, grouped] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    grouped.forEach((g) => { counts[g.status] = g._count._all; });
    return { tickets, counts };
  }

  async updateSupportTicket(id: string, patch: { status?: string; response?: string }) {
    const data: any = {};
    const valid = ['open', 'in_progress', 'resolved', 'closed'];
    if (patch.status && valid.includes(patch.status)) {
      data.status = patch.status;
      if (patch.status === 'resolved' || patch.status === 'closed') data.resolvedAt = new Date();
    }
    if (patch.response !== undefined) data.response = patch.response;
    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  async traffic() {
    // Build real analytics from AppEvent. Frontend reads {daily[], funnel[], topPaths[], eventBreakdown, totalEvents}.
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13); // last 14 days
    const events = await this.prisma.appEvent
      .findMany({ where: { createdAt: { gte: start } }, select: { type: true, payload: true, createdAt: true } })
      .catch(() => [] as any[]);

    // daily counts
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    const eventBreakdown: Record<string, number> = {};
    const pathMap = new Map<string, number>();
    for (const e of events) {
      const day = new Date(e.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      eventBreakdown[e.type] = (eventBreakdown[e.type] || 0) + 1;
      const path = (e.payload as any)?.path;
      if (path) pathMap.set(path, (pathMap.get(path) || 0) + 1);
    }
    const daily = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));
    const topPaths = Array.from(pathMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Simple acquisition funnel
    const [tenants, withInvoice, paid] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.invoice.findMany({ distinct: ['tenantId'], select: { tenantId: true } }).then((r) => r.length).catch(() => 0),
      this.prisma.subscription.count({ where: { plan: { not: 'FREE' } } }).catch(() => 0),
    ]);
    const funnel = [
      { step: 'Registros', count: tenants },
      { step: 'Emitió factura', count: withInvoice },
      { step: 'Plan pago', count: paid },
    ];

    return {
      trafficToday: daily[daily.length - 1]?.count ?? 0,
      totalEvents: events.length,
      daily,
      funnel,
      topPaths,
      eventBreakdown,
    };
  }

  /**
   * Superadmin resetea la contraseña de cualquier usuario. Devuelve la clave temporal
   * para que el operador se la comunique al negocio. Genera una si no se provee.
   */
  async resetUserPassword(params: { userId?: string; email?: string; newPassword?: string }) {
    const where = params.userId
      ? { id: params.userId }
      : { email: { equals: (params.email || '').trim().toLowerCase(), mode: 'insensitive' as const } };
    const user = await this.prisma.user.findFirst({ where });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Clave temporal legible si no viene una explícita (ej. "Kaivor-7F3K9A").
    const temp =
      params.newPassword && String(params.newPassword).length >= 8
        ? String(params.newPassword)
        : `Kaivor-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const hashed = await bcrypt.hash(temp, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetTokenHash: null, resetTokenExpiresAt: null },
    });

    return { ok: true, email: user.email, name: user.name, temporaryPassword: temp };
  }

  async automations() {
    // Frontend reads {automations:[{id,name,desc}]}. Aggregate distinct automation types from runs.
    const runs = await this.prisma.automationRun
      .findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
      .catch(() => [] as any[]);
    const byType = new Map<string, { id: string; name: string; desc: string; runs: number; lastRun: Date | null }>();
    for (const r of runs as any[]) {
      const key = r.automationId || r.type || r.id;
      const cur = byType.get(key) || {
        id: key,
        name: r.name || r.type || 'Automatización',
        desc: r.status ? `Última: ${r.status}` : 'Ejecuciones registradas',
        runs: 0,
        lastRun: null,
      };
      cur.runs += 1;
      if (!cur.lastRun || r.createdAt > cur.lastRun) cur.lastRun = r.createdAt;
      byType.set(key, cur);
    }
    return { automations: Array.from(byType.values()), runs };
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

  /**
   * Acciones del superadmin sobre un tenant (negocio) desde la Consola:
   * - change-plan: cambia el plan de la suscripción (la crea si no existe).
   * - suspend / reactivate: activa o desactiva el acceso del negocio.
   */
  async updateCustomer(tenantId: string, body: { action?: string; plan?: string }) {
    const VALID_PLANS = ['FREE', 'STARTER', 'PRO_AI', 'BUSINESS', 'ENTERPRISE'];
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    const action = body?.action || 'change-plan';

    if (action === 'change-plan') {
      const plan = (body?.plan || '').toUpperCase();
      if (!VALID_PLANS.includes(plan)) throw new NotFoundException('Plan no válido');
      // Periodo de 30 días desde ahora (requerido por el modelo Subscription).
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub = await this.prisma.subscription.upsert({
        where: { tenantId },
        create: { tenantId, plan, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd },
        update: { plan, status: 'active' },
      });
      return { ok: true, action, plan: sub.plan };
    }

    if (action === 'suspend' || action === 'reactivate') {
      const isActive = action === 'reactivate';
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { isActive } });
      await this.prisma.subscription.updateMany({
        where: { tenantId },
        data: { status: isActive ? 'active' : 'cancelled' },
      });
      return { ok: true, action, isActive };
    }

    throw new NotFoundException('Acción no soportada');
  }
}
