import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * AI quota by plan. Visible limit = AI messages per calendar month (simple for the customer).
 * Internally also caps output tokens per response (anti-abuse / cost control).
 *
 * AI conversational agents unlock from PRO_AI and up. FREE/STARTER see a teaser.
 */

export const PLAN_RANK: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  PRO_AI: 2,
  BUSINESS: 3,
  ENTERPRISE: 4,
};

// Minimum plan to use the real conversational AI.
export const AI_MIN_PLAN = 'PRO_AI';

// Visible monthly AI message allowance per plan. -1 = unlimited.
export const AI_MONTHLY_MESSAGES: Record<string, number> = {
  FREE: 0,
  STARTER: 0,
  PRO_AI: 500,
  BUSINESS: 2000,
  ENTERPRISE: -1,
};

// Internal output-token cap per response (anti-abuse). Higher plans get longer answers.
export const AI_MAX_OUTPUT_TOKENS: Record<string, number> = {
  PRO_AI: 600,
  BUSINESS: 900,
  ENTERPRISE: 1200,
};

export interface QuotaCheck {
  allowed: boolean;
  reason?: 'plan_too_low' | 'limit_reached';
  plan: string;
  limit: number; // -1 = unlimited
  used: number;
  remaining: number; // -1 = unlimited
  maxOutputTokens: number;
  message?: string;
}

@Injectable()
export class AiQuotaService {
  constructor(private prisma: PrismaService) {}

  private monthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /** AI messages consumed by this tenant in the current calendar month. */
  async usedThisMonth(tenantId: string): Promise<number> {
    const agg = await this.prisma.usageEvent.aggregate({
      where: { tenantId, eventType: 'ai_credit_used', createdAt: { gte: this.monthStart() } },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  /** Check whether the tenant may make an AI call right now. Does NOT consume. */
  async check(tenantId: string, plan: string): Promise<QuotaCheck> {
    const rank = PLAN_RANK[plan] ?? 0;
    const limit = AI_MONTHLY_MESSAGES[plan] ?? 0;
    const maxOutputTokens = AI_MAX_OUTPUT_TOKENS[plan] ?? AI_MAX_OUTPUT_TOKENS.PRO_AI;

    if (rank < (PLAN_RANK[AI_MIN_PLAN] ?? 99)) {
      return {
        allowed: false,
        reason: 'plan_too_low',
        plan,
        limit,
        used: 0,
        remaining: 0,
        maxOutputTokens,
        message: `La IA conversacional está disponible desde el plan ${AI_MIN_PLAN}. Mejora tu plan para activarla.`,
      };
    }

    if (limit === -1) {
      return { allowed: true, plan, limit: -1, used: 0, remaining: -1, maxOutputTokens };
    }

    const used = await this.usedThisMonth(tenantId);
    if (used >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        plan,
        limit,
        used,
        remaining: 0,
        maxOutputTokens,
        message: `Llegaste a tu límite de ${limit} consultas de IA este mes. Mejora tu plan o espera al próximo ciclo.`,
      };
    }

    return { allowed: true, plan, limit, used, remaining: limit - used, maxOutputTokens };
  }

  /** Record one consumed AI message (+ token usage for analytics). Call AFTER a successful LLM response. */
  async consume(tenantId: string, totalTokens: number, meta?: Record<string, any>): Promise<void> {
    await this.prisma.usageEvent.create({
      data: {
        tenantId,
        eventType: 'ai_credit_used',
        quantity: 1,
        metadata: { totalTokens, ...(meta || {}) },
      },
    });
  }
}
