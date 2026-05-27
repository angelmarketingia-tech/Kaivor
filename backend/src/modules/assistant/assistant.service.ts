import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AssistantService {
  constructor(private prisma: PrismaService) {}

  async ask(tenantId: string, question: string, plan: string) {
    const q = (question || '').toLowerCase();
    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);

    // Real-data answers for common business questions
    if (q.includes('venta') || q.includes('factura') || q.includes('facturado')) {
      const agg = await this.prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true }, _count: true });
      return { answer: `Has facturado ${fmt(agg._sum.total || 0)} en ${agg._count} facturas.`, teaser: false };
    }
    if (q.includes('cliente')) {
      const count = await this.prisma.customer.count({ where: { tenantId } });
      return { answer: `Tienes ${count} cliente(s) registrado(s).`, teaser: false };
    }
    if (q.includes('producto')) {
      const count = await this.prisma.product.count({ where: { tenantId } });
      return { answer: `Tienes ${count} producto(s) en tu catálogo.`, teaser: false };
    }

    if (!hasAI) {
      return { answer: 'El asistente con IA conversacional completa está disponible en planes superiores. Puedes preguntar por ventas, clientes o productos.', teaser: true };
    }
    return { answer: 'Soy tu asistente Kaivor. Pregúntame por ventas, clientes, productos o inventario.', teaser: false };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
