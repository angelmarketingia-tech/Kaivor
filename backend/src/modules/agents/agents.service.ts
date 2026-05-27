import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const AGENTS = [
  { type: 'sales', name: 'Agente de Ventas', icon: '💰', desc: 'Analiza ventas y oportunidades', minPlan: 'PRO_AI' },
  { type: 'inventory', name: 'Agente de Inventario', icon: '📦', desc: 'Optimiza stock y reposición', minPlan: 'PRO_AI' },
  { type: 'finance', name: 'Agente Financiero', icon: '📊', desc: 'Cartera, flujo de caja y cobros', minPlan: 'BUSINESS' },
  { type: 'hr', name: 'Agente de RRHH', icon: '👥', desc: 'Nómina y gestión de personal', minPlan: 'BUSINESS' },
];

const PLAN_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO_AI: 2, BUSINESS: 3, ENTERPRISE: 4 };

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  async list(plan: string) {
    const rank = PLAN_RANK[plan] ?? 0;
    return {
      plan,
      agents: AGENTS.map((a) => ({ ...a, available: rank >= (PLAN_RANK[a.minPlan] ?? 99) })),
    };
  }

  async ask(tenantId: string, type: string, question: string, plan: string) {
    const agent = AGENTS.find((a) => a.type === type);
    const rank = PLAN_RANK[plan] ?? 0;
    if (!agent) return { answer: 'Agente no encontrado.', suggestions: [] };
    if (rank < (PLAN_RANK[agent.minPlan] ?? 99)) {
      return { answer: `El ${agent.name} requiere el plan ${agent.minPlan} o superior.`, teaser: true, suggestions: [] };
    }

    if (type === 'sales') {
      const agg = await this.prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true }, _count: true });
      return { answer: `Has facturado ${fmt(agg._sum.total || 0)} en ${agg._count} facturas. ¿Quieres que analice tus mejores clientes?`, suggestions: [{ label: 'Mejores clientes', action: 'top_customers' }] };
    }
    if (type === 'inventory') {
      const inv = await this.prisma.inventory.findMany({ where: { tenantId } });
      const low = inv.filter((i) => Number(i.quantity) <= Number(i.reorderPoint)).length;
      return { answer: `Tienes ${low} producto(s) que requieren reposición de ${inv.length} seguidos.`, suggestions: [] };
    }
    if (type === 'finance') {
      const overdue = await this.prisma.invoice.count({ where: { tenantId, status: { in: ['draft', 'sent'] }, dueDate: { lt: new Date() } } });
      return { answer: `Tienes ${overdue} factura(s) vencida(s) por cobrar.`, suggestions: [] };
    }
    if (type === 'hr') {
      const emp = await this.prisma.employee.count({ where: { tenantId, status: 'active' } });
      return { answer: `Tienes ${emp} empleado(s) activo(s).`, suggestions: [] };
    }
    return { answer: 'Pregúntame sobre tu operación.', suggestions: [] };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
