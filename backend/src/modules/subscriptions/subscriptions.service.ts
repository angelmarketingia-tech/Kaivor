import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export const PLAN_LIMITS = {
  FREE: {
    invoicesPerMonth: 45,
    usersMax: 1,
    woocommerce: false,
    aiInsights: false,
  },
  STARTER: {
    invoicesPerMonth: 150,
    usersMax: 2,
    woocommerce: false,
    aiInsights: false,
  },
  PRO_AI: {
    invoicesPerMonth: 500,
    usersMax: 5,
    woocommerce: true,
    aiInsights: true,
  },
  BUSINESS: {
    invoicesPerMonth: 99999,
    usersMax: 10,
    woocommerce: true,
    aiInsights: true,
  },
  ENTERPRISE: {
    invoicesPerMonth: 99999,
    usersMax: 99999,
    woocommerce: true,
    aiInsights: true,
  },
} as const;

type PlanKey = keyof typeof PLAN_LIMITS;

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async createDefaultSubscription(tenantId: string) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.create({
      data: {
        tenantId,
        plan: 'FREE',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  async getCurrentSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!sub) {
      return this.createDefaultSubscription(tenantId);
    }

    return sub;
  }

  async getPlans() {
    return Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
      plan,
      limits,
      price: this.getPlanPrice(plan as PlanKey),
      label: this.getPlanLabel(plan as PlanKey),
      description: this.getPlanDescription(plan as PlanKey),
    }));
  }

  async getUsage(tenantId: string) {
    const sub = await this.getCurrentSubscription(tenantId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoicesThisMonth = await this.prisma.usageEvent.count({
      where: {
        tenantId,
        eventType: 'invoice_created',
        createdAt: { gte: monthStart },
      },
    });

    const plan = (sub.plan as PlanKey) in PLAN_LIMITS ? (sub.plan as PlanKey) : 'FREE';
    const limits = PLAN_LIMITS[plan];

    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      invoices: {
        used: invoicesThisMonth,
        limit: limits.invoicesPerMonth,
        remaining: Math.max(0, limits.invoicesPerMonth - invoicesThisMonth),
        percentage: Math.min(100, Math.round((invoicesThisMonth / limits.invoicesPerMonth) * 100)),
      },
      features: {
        woocommerce: limits.woocommerce,
        aiInsights: limits.aiInsights,
        usersMax: limits.usersMax,
      },
    };
  }

  async changePlan(tenantId: string, newPlan: string) {
    const validPlans = Object.keys(PLAN_LIMITS);
    if (!validPlans.includes(newPlan)) {
      throw new ForbiddenException(`Plan inválido: ${newPlan}`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        plan: newPlan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        tenantId,
        plan: newPlan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  async checkInvoiceLimit(tenantId: string): Promise<void> {
    const usage = await this.getUsage(tenantId);

    if (usage.invoices.remaining <= 0) {
      throw new ForbiddenException(
        `Llegaste al límite de facturas del plan ${usage.plan}. ` +
        `Sube a Pro AI para seguir facturando y desbloquear automatizaciones.`,
      );
    }
  }

  async requireFeature(tenantId: string, feature: 'woocommerce' | 'aiInsights'): Promise<void> {
    const usage = await this.getUsage(tenantId);

    if (!usage.features[feature]) {
      const messages: Record<string, string> = {
        woocommerce:
          'WooCommerce está disponible en Pro AI y Business. Conecta tu tienda para importar pedidos automáticamente.',
        aiInsights:
          'Desbloquea Kaivor AI para analizar tus ventas, detectar errores y recibir recomendaciones inteligentes.',
      };
      throw new ForbiddenException(messages[feature]);
    }
  }

  async trackUsage(
    tenantId: string,
    eventType: string,
    quantity = 1,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.usageEvent.create({
      data: {
        tenantId,
        eventType,
        quantity,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private getPlanPrice(plan: PlanKey): string {
    const prices: Record<PlanKey, string> = {
      FREE: '$0',
      STARTER: '$19',
      PRO_AI: '$49',
      BUSINESS: '$99',
      ENTERPRISE: 'Custom',
    };
    return prices[plan];
  }

  private getPlanLabel(plan: PlanKey): string {
    const labels: Record<PlanKey, string> = {
      FREE: 'Gratis',
      STARTER: 'Starter',
      PRO_AI: 'Pro AI',
      BUSINESS: 'Business',
      ENTERPRISE: 'Enterprise',
    };
    return labels[plan];
  }

  private getPlanDescription(plan: PlanKey): string {
    const descriptions: Record<PlanKey, string> = {
      FREE: 'Empieza facturando gratis. Sin tarjeta de crédito.',
      STARTER: 'Más facturas y funciones básicas para crecer.',
      PRO_AI: 'IA, reportes e integración con WooCommerce.',
      BUSINESS: 'Equipos, automatizaciones y ecommerce avanzado.',
      ENTERPRISE: 'Solución personalizada para empresas grandes.',
    };
    return descriptions[plan];
  }
}
