import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getInventory(tenantId: string, warehouse?: string) {
    const rows = await this.prisma.inventory.findMany({
      where: { tenantId, ...(warehouse && { warehouse }) },
      include: { product: true },
    });
    return rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      reorderPoint: Number(r.reorderPoint),
    }));
  }

  async getInventoryForProduct(productId: string, tenantId: string) {
    const rows = await this.prisma.inventory.findMany({
      where: { productId, tenantId },
    });
    return rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      reorderPoint: Number(r.reorderPoint),
    }));
  }

  async getAlerts(tenantId: string) {
    const rows = await this.prisma.inventory.findMany({
      where: { tenantId },
      include: { product: { select: { name: true, sku: true } } },
    });

    const alerts: any[] = [];
    let outOfStock = 0;
    let lowStock = 0;

    for (const r of rows) {
      const qty = Number(r.quantity);
      const reorder = Number(r.reorderPoint);
      if (qty <= 0) {
        outOfStock++;
        alerts.push({
          type: 'out_of_stock',
          severity: 'high',
          productId: r.productId,
          productName: r.product?.name || 'Producto',
          sku: r.product?.sku || '',
          quantity: qty,
          reorderPoint: reorder,
          message: 'Sin stock disponible',
        });
      } else if (qty <= reorder) {
        lowStock++;
        alerts.push({
          type: 'low_stock',
          severity: 'medium',
          productId: r.productId,
          productName: r.product?.name || 'Producto',
          sku: r.product?.sku || '',
          quantity: qty,
          reorderPoint: reorder,
          message: `Stock bajo (mínimo ${reorder})`,
        });
      }
    }

    alerts.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0));

    return {
      alerts,
      summary: { outOfStock, lowStock, trackedProducts: rows.length },
    };
  }

  async ask(tenantId: string, question: string, plan: string) {
    const q = (question || '').toLowerCase();
    const rows = await this.prisma.inventory.findMany({
      where: { tenantId },
      include: { product: { select: { name: true, sku: true } } },
    });

    const tracked = rows.map((r) => ({
      name: r.product?.name || 'Producto',
      qty: Number(r.quantity),
      reorder: Number(r.reorderPoint),
    }));

    if (q.includes('sin stock') || q.includes('agotado')) {
      const out = tracked.filter((p) => p.qty <= 0);
      return {
        answer: out.length
          ? `Tienes ${out.length} producto(s) sin stock: ${out.map((p) => p.name).join(', ')}.`
          : 'No tienes productos sin stock. Todo en orden.',
        teaser: false,
      };
    }
    if (q.includes('stock bajo') || q.includes('reponer') || q.includes('reorden')) {
      const low = tracked.filter((p) => p.qty > 0 && p.qty <= p.reorder);
      return {
        answer: low.length
          ? `Debes reponer ${low.length} producto(s): ${low.map((p) => `${p.name} (${p.qty} und)`).join(', ')}.`
          : 'Ningún producto está por debajo del punto de reorden.',
        teaser: false,
      };
    }
    if (q.includes('más vendido') || q.includes('mas vendido')) {
      const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);
      if (!hasAI) {
        return {
          answer: 'El análisis de productos más vendidos está disponible en planes con IA.',
          teaser: true,
        };
      }
      const top = await this.prisma.transactionItem.groupBy({
        by: ['productId'],
        where: { tenantId },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      });
      if (!top.length) return { answer: 'Aún no hay ventas registradas para calcular los más vendidos.', teaser: false };
      const names = await Promise.all(
        top.map(async (t) => {
          const p = await this.prisma.product.findUnique({ where: { id: t.productId }, select: { name: true } });
          return `${p?.name || t.productId} (${Number(t._sum.quantity)} und)`;
        }),
      );
      return { answer: `Tus productos más vendidos: ${names.join(', ')}.`, teaser: false };
    }

    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);
    return {
      answer: hasAI
        ? `Tienes ${tracked.length} producto(s) con inventario seguido. Pregúntame por stock bajo, productos sin stock o más vendidos.`
        : 'Las consultas avanzadas en lenguaje natural están disponibles en planes con IA. Puedes preguntar por stock bajo o productos sin stock.',
      teaser: !hasAI,
    };
  }

  async adjustInventory(
    tenantId: string,
    productId: string,
    warehouse: string,
    quantity: bigint,
    type: string,
    reference?: string,
  ) {
    await this.prisma.inventory.upsert({
      where: { tenantId_productId_warehouse: { tenantId, productId, warehouse } },
      update: { quantity: { increment: quantity } },
      create: { tenantId, productId, warehouse, quantity },
    });

    const inv = await this.prisma.inventory.findUnique({
      where: { tenantId_productId_warehouse: { tenantId, productId, warehouse } },
    });

    return this.prisma.inventoryMovement.create({
      data: { tenantId, inventoryId: inv?.id || '', type, quantity, reference },
    });
  }
}
