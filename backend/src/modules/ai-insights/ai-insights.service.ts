import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Injectable()
export class AiInsightsService {
  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async getMonthlySummary(tenantId: string) {
    await this.subscriptionsService.requireFeature(tenantId, 'aiInsights');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [invoiceStats, topCustomers, topProducts, pendingInvoices] = await Promise.all([
      // Resumen de facturas del mes
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: true,
      }),

      // Top 3 clientes por ingresos este mes
      this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'cancelled' } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 3,
      }),

      // Producto más vendido (por transacciones)
      this.prisma.transactionItem.groupBy({
        by: ['productId'],
        where: { tenantId, transaction: { createdAt: { gte: monthStart } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 1,
      }),

      // Facturas pendientes
      this.prisma.invoice.count({
        where: { tenantId, status: 'draft' },
      }),
    ]);

    const totalRevenue = invoiceStats._sum.total ?? 0;
    const totalInvoices = invoiceStats._count;

    // Resolver nombres de clientes
    let topCustomerData: { name: string; revenue: number; percentage: number }[] = [];
    if (topCustomers.length > 0) {
      const customerIds = topCustomers.map((tc: { customerId: string; _sum: { total: any } }) => tc.customerId);
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      });

      const customerMap = new Map(customers.map((cu: { id: string; name: string }) => [cu.id, cu.name]));

      topCustomerData = topCustomers.map((tc: { customerId: string; _sum: { total: any } }) => ({
        name: customerMap.get(tc.customerId) || 'Cliente desconocido',
        revenue: tc._sum.total ?? 0,
        percentage:
          totalRevenue > 0
            ? Math.round(((tc._sum.total ?? 0) / totalRevenue) * 100)
            : 0,
      }));
    }

    // Resolver nombre de producto top
    let topProductName = 'Sin datos';
    if (topProducts.length > 0 && topProducts[0].productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: topProducts[0].productId as string },
        select: { name: true },
      });
      topProductName = product?.name ?? 'Producto desconocido';
    }

    // Generar texto del resumen (determinístico, sin IA externa)
    const summary = this.buildSummaryText({
      totalRevenue,
      totalInvoices,
      topCustomerData,
      topProductName,
      pendingInvoices,
    });

    await this.subscriptionsService.trackUsage(tenantId, 'ai_credit_used', 1, {
      feature: 'monthly_summary',
    });

    return {
      period: `${monthStart.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`,
      totalRevenue,
      totalInvoices,
      pendingInvoices,
      topCustomers: topCustomerData,
      topProduct: topProductName,
      summary,
    };
  }

  async checkInvoice(tenantId: string, invoiceData: Record<string, unknown>) {
    const issues: string[] = [];
    const customerId = invoiceData.customerId as string | undefined;
    const total = Number(invoiceData.total ?? 0);

    // Verificar cliente
    if (!customerId) {
      issues.push('No seleccionaste un cliente para esta factura.');
    } else {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        issues.push('El cliente seleccionado no existe.');
      } else {
        if (!customer.taxId) {
          issues.push('El cliente no tiene documento fiscal (NIT/RUT). Puede causar problemas con DIAN.');
        }
        if (!customer.address) {
          issues.push('La dirección del cliente está incompleta.');
        }
      }
    }

    // Verificar total
    if (!total || total <= 0) {
      issues.push('El total de la factura es $0 o negativo.');
    }

    if (total > 100_000_000) {
      issues.push('El total de la factura es inusualmente alto. Verifica que esté en la moneda correcta.');
    }

    // Verificar fecha
    if (!invoiceData.invoiceDate) {
      issues.push('La fecha de la factura es obligatoria.');
    }

    // Verificar número de factura
    if (!invoiceData.invoiceNumber) {
      issues.push('El número de factura es obligatorio.');
    }

    const hasIssues = issues.length > 0;

    return {
      valid: !hasIssues,
      issueCount: issues.length,
      issues,
      message: hasIssues
        ? `Detectamos ${issues.length} problema${issues.length > 1 ? 's' : ''} antes de generar la factura.`
        : 'La factura parece correcta. Puedes crearla.',
    };
  }

  async getRecommendations(tenantId: string) {
    await this.subscriptionsService.requireFeature(tenantId, 'aiInsights');

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [inactiveCustomers, overdueInvoices, pendingInvoicesAmount] =
      await Promise.all([
        // Clientes que no compran hace más de 30 días
        this.prisma.customer.findMany({
          where: {
            tenantId,
            invoices: {
              none: {
                createdAt: { gte: thirtyDaysAgo },
                status: { not: 'cancelled' },
              },
            },
          },
          take: 5,
          select: { id: true, name: true },
        }),

        // Facturas vencidas (draft con más de 30 días)
        this.prisma.invoice.count({
          where: {
            tenantId,
            status: 'draft',
            createdAt: { lte: thirtyDaysAgo },
          },
        }),

        // Monto total de facturas pendientes
        this.prisma.invoice.aggregate({
          where: { tenantId, status: 'draft' },
          _sum: { total: true },
        }),
      ]);

    const recommendations: { type: string; title: string; body: string; priority: string }[] = [];

    if (inactiveCustomers.length > 0) {
      recommendations.push({
        type: 'reactivation',
        title: 'Clientes inactivos',
        body: `Tienes ${inactiveCustomers.length} cliente${inactiveCustomers.length > 1 ? 's' : ''} que no compra${inactiveCustomers.length > 1 ? 'n' : ''} hace más de 30 días. Puedes enviarles una campaña de recompra.`,
        priority: 'medium',
      });
    }

    if (overdueInvoices > 0) {
      const amount = pendingInvoicesAmount._sum.total ?? 0;
      recommendations.push({
        type: 'collection',
        title: 'Facturas por cobrar',
        body: `Tienes ${overdueInvoices} factura${overdueInvoices > 1 ? 's' : ''} pendiente${overdueInvoices > 1 ? 's' : ''} por $${amount.toLocaleString('es-CO')}. Activa recordatorios automáticos para mejorar tu cobranza.`,
        priority: 'high',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'positive',
        title: 'Todo en orden',
        body: 'No hay alertas urgentes. Tu operación está al día.',
        priority: 'low',
      });
    }

    await this.subscriptionsService.trackUsage(tenantId, 'ai_credit_used', 1, {
      feature: 'recommendations',
    });

    return { recommendations };
  }

  private buildSummaryText(data: {
    totalRevenue: number;
    totalInvoices: number;
    topCustomerData: { name: string; revenue: number; percentage: number }[];
    topProductName: string;
    pendingInvoices: number;
  }): string {
    const { totalRevenue, totalInvoices, topCustomerData, topProductName, pendingInvoices } = data;

    const lines: string[] = [];

    if (totalInvoices === 0) {
      lines.push('Este mes no tienes facturas registradas. Crea tu primera factura para empezar a ver tus métricas.');
    } else {
      lines.push(`Este mes facturaste $${totalRevenue.toLocaleString('es-CO')}.`);

      if (topCustomerData.length > 0) {
        const topPct = topCustomerData.reduce((s, c) => s + c.percentage, 0);
        const topNames = topCustomerData.map((c) => c.name).join(', ');
        lines.push(`Tus ${topCustomerData.length} mejores clientes (${topNames}) generaron el ${topPct}% de ingresos.`);
      }

      if (pendingInvoices > 0) {
        lines.push(`Tienes ${pendingInvoices} factura${pendingInvoices > 1 ? 's' : ''} pendiente${pendingInvoices > 1 ? 's' : ''} por cobrar.`);
      }

      if (topProductName !== 'Sin datos') {
        lines.push(`Tu producto más vendido fue ${topProductName}.`);
      }
    }

    return lines.join(' ');
  }
}
