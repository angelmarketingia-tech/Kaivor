import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { llmChat } from '@/common/llm';
import { AiQuotaService, PLAN_RANK } from '@/common/ai-quota';

const AGENTS = [
  { type: 'sales', name: 'Agente de Ventas', icon: '💰', desc: 'Analiza ventas y oportunidades', minPlan: 'PRO_AI' },
  { type: 'inventory', name: 'Agente de Inventario', icon: '📦', desc: 'Optimiza stock y reposición', minPlan: 'PRO_AI' },
  { type: 'finance', name: 'Agente Financiero', icon: '📊', desc: 'Cartera, flujo de caja y cobros', minPlan: 'BUSINESS' },
  { type: 'hr', name: 'Agente de RRHH', icon: '👥', desc: 'Nómina y gestión de personal', minPlan: 'BUSINESS' },
];

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private prisma: PrismaService, private quota: AiQuotaService) {}

  async list(plan: string) {
    const rank = PLAN_RANK[plan] ?? 0;
    return {
      plan,
      agents: AGENTS.map((a) => ({ ...a, available: rank >= (PLAN_RANK[a.minPlan] ?? 99) })),
    };
  }

  async ask(
    tenantId: string,
    type: string,
    question: string,
    plan: string,
    history: Array<{ role: string; content: string }> = [],
  ) {
    const agent = AGENTS.find((a) => a.type === type);
    if (!agent) return { answer: 'Agente no encontrado.', suggestions: [], blocked: true };

    const q = (question || '').trim();
    if (!q) return { answer: 'Escríbeme una pregunta sobre tu operación.', suggestions: [] };

    // Per-agent minimum plan (finance/hr need BUSINESS).
    const rank = PLAN_RANK[plan] ?? 0;
    if (rank < (PLAN_RANK[agent.minPlan] ?? 99)) {
      return {
        answer: `El ${agent.name} requiere el plan ${agent.minPlan} o superior. Mejora tu plan para activarlo.`,
        teaser: true,
        blocked: true,
        upgrade: true,
        suggestions: [],
      };
    }

    // Global AI quota (plan gate + monthly message limit).
    const quota = await this.quota.check(tenantId, plan);
    if (!quota.allowed) {
      return {
        answer: quota.message,
        teaser: quota.reason === 'plan_too_low',
        blocked: true,
        upgrade: true,
        limit: quota.limit,
        used: quota.used,
        suggestions: [],
      };
    }

    // Gather REAL data for this agent's domain.
    const dataContext = await this.buildDataContext(tenantId, type);

    const systemPrompt =
      `Eres "${agent.name}", un asistente de negocio de la plataforma Kaivor para PYMEs colombianas. ` +
      `${agent.desc}. Respondes SOLO con base en los DATOS REALES del negocio que se incluyen abajo; ` +
      `si te preguntan algo fuera de esos datos, dilo con honestidad y sugiere qué dato falta. ` +
      `Da respuestas concretas, accionables y breves (máximo 4 frases salvo que pidan detalle). ` +
      `Usa pesos colombianos (COP) con separador de miles. Nunca inventes cifras. Idioma: español de Colombia.\n\n` +
      `=== DATOS REALES DEL NEGOCIO (${agent.name}) ===\n${dataContext}\n=== FIN DE DATOS ===`;

    // Build message array: system + recent history (last 8) + current question.
    const trimmedHistory = (history || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 2000) }));

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...trimmedHistory,
      { role: 'user' as const, content: q.slice(0, 2000) },
    ];

    const res = await llmChat(messages, { temperature: 0.4, maxTokens: quota.maxOutputTokens });

    if (!res.ok) {
      this.logger.warn(`LLM error for agent ${type}: ${res.error}`);
      return {
        answer: 'No pude procesar tu pregunta en este momento. Intenta de nuevo en unos segundos.',
        error: res.error,
        suggestions: [],
      };
    }

    // Consume one AI credit only on a successful, real LLM answer.
    await this.quota.consume(tenantId, res.totalTokens, { agent: type });

    const remaining = quota.limit === -1 ? -1 : Math.max(0, quota.limit - quota.used - 1);
    return {
      answer: res.content || 'No tengo una respuesta para eso ahora mismo.',
      remaining,
      limit: quota.limit,
      suggestions: [],
    };
  }

  /** Loads the real domain data each agent reasons over. Kept compact to control prompt cost. */
  private async buildDataContext(tenantId: string, type: string): Promise<string> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

    try {
      if (type === 'sales') {
        const [monthAgg, prevAgg, topItems, count] = await Promise.all([
          this.prisma.invoice.aggregate({ where: { tenantId, status: { not: 'cancelled' }, createdAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
          this.prisma.invoice.aggregate({ where: { tenantId, status: { not: 'cancelled' }, createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), lt: monthStart } }, _sum: { total: true }, _count: true }),
          this.prisma.invoice.groupBy({ by: ['customerId'], where: { tenantId, status: { not: 'cancelled' } }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 5 }),
          this.prisma.invoice.count({ where: { tenantId, status: { not: 'cancelled' } } }),
        ]);
        const custIds = topItems.map((t) => t.customerId).filter(Boolean);
        const custs = custIds.length ? await this.prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : [];
        const nameMap = new Map(custs.map((c) => [c.id, c.name]));
        const top = topItems.map((t) => `${nameMap.get(t.customerId) || 'Cliente'}: ${fmt(t._sum.total ?? 0)}`).join('; ');
        return [
          `Facturación este mes: ${fmt(monthAgg._sum.total ?? 0)} en ${monthAgg._count} facturas.`,
          `Facturación mes anterior: ${fmt(prevAgg._sum.total ?? 0)} en ${prevAgg._count} facturas.`,
          `Total histórico de facturas (no canceladas): ${count}.`,
          `Mejores 5 clientes por ingresos: ${top || 'sin datos'}.`,
        ].join('\n');
      }

      if (type === 'inventory') {
        const inv = await this.prisma.inventory.findMany({ where: { tenantId }, take: 500, select: { quantity: true, reorderPoint: true, productId: true } });
        const low = inv.filter((i) => Number(i.quantity) <= Number(i.reorderPoint));
        const lowIds = low.slice(0, 10).map((i) => i.productId);
        const prods = lowIds.length ? await this.prisma.product.findMany({ where: { id: { in: lowIds } }, select: { id: true, name: true } }) : [];
        const pMap = new Map(prods.map((p) => [p.id, p.name]));
        const lowList = low.slice(0, 10).map((i) => `${pMap.get(i.productId) || 'Producto'} (stock ${Number(i.quantity)}, punto de reorden ${Number(i.reorderPoint)})`).join('; ');
        return [
          `Productos con inventario registrado: ${inv.length}.`,
          `Productos en o bajo punto de reorden: ${low.length}.`,
          `Items que requieren reposición: ${lowList || 'ninguno'}.`,
        ].join('\n');
      }

      if (type === 'finance') {
        const [overdue, pending, paidMonth] = await Promise.all([
          this.prisma.invoice.aggregate({ where: { tenantId, status: { in: ['draft', 'sent'] }, dueDate: { lt: now } }, _sum: { total: true }, _count: true }),
          this.prisma.invoice.aggregate({ where: { tenantId, status: { in: ['draft', 'sent'] } }, _sum: { total: true }, _count: true }),
          this.prisma.payment.aggregate({ where: { tenantId, createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }).catch(() => null),
        ]);
        return [
          `Cartera vencida (facturas sin cobrar pasadas de fecha): ${fmt(overdue._sum.total ?? 0)} en ${overdue._count} facturas.`,
          `Cartera total por cobrar (borrador/enviadas): ${fmt(pending._sum.total ?? 0)} en ${pending._count} facturas.`,
          paidMonth ? `Pagos recibidos este mes: ${fmt(paidMonth._sum.amount ?? 0)} en ${paidMonth._count} pagos.` : `Pagos del mes: sin datos.`,
        ].join('\n');
      }

      if (type === 'hr') {
        const [active, total, payroll] = await Promise.all([
          this.prisma.employee.count({ where: { tenantId, status: 'active' } }),
          this.prisma.employee.count({ where: { tenantId } }),
          this.prisma.payrollPeriod.count({ where: { tenantId } }).catch(() => 0),
        ]);
        return [
          `Empleados activos: ${active} de ${total} registrados.`,
          `Periodos de nómina registrados: ${payroll}.`,
        ].join('\n');
      }
    } catch (e: any) {
      this.logger.warn(`buildDataContext failed for ${type}: ${e?.message}`);
      return 'No se pudieron cargar todos los datos del negocio en este momento.';
    }
    return 'Sin datos disponibles.';
  }
}
