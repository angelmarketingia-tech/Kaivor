import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AssistantService {
  constructor(private prisma: PrismaService) {}

  async ask(tenantId: string, question: string, plan: string) {
    const q = (question || '').toLowerCase();
    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);

    // Tokenize for word-boundary matching so 'inventario' doesn't match 'venta'
    const tokens = q.split(/[^a-záéíóúñ]+/i).filter(Boolean);
    const hasToken = (...words: string[]) =>
      words.some((w) => tokens.some((t) => t === w || t.startsWith(w)));

    // Inventory branch FIRST — 'inventario'/'stock' must not fall into sales
    if (hasToken('inventario', 'stock', 'existencia', 'existencias', 'bodega', 'almacen', 'almacén')) {
      const inventories = await this.prisma.inventory.findMany({
        where: { tenantId },
        select: { quantity: true, reorderPoint: true },
      });
      const low = inventories.filter((i) => i.quantity <= i.reorderPoint).length;
      const totalUnits = inventories.reduce((acc, i) => acc + Number(i.quantity), 0);
      return {
        answer: `Tienes ${totalUnits} unidad(es) en inventario. ${low} ítem(s) están en o por debajo del punto de reorden.`,
        teaser: false,
      };
    }

    // Pending / por cobrar branch — must come before generic sales (which matches 'cobrar')
    if (hasToken('pendiente', 'pendientes', 'cobrar', 'cobranza', 'pagar', 'impagas', 'impaga', 'adeudado', 'deben', 'debe')) {
      const pending = await this.prisma.invoice.aggregate({
        where: { tenantId, status: 'draft' },
        _sum: { total: true },
        _count: true,
      });
      const amount = pending._sum.total ?? 0;
      return {
        answer: pending._count
          ? `Tienes ${pending._count} factura(s) pendiente(s) por cobrar, por un total de ${fmt(amount)}.`
          : 'No tienes facturas pendientes por cobrar. Todo al día.',
        teaser: false,
      };
    }

    // Ranking / superlative branch — 'mejor cliente', 'top productos', 'producto más vendido', etc. (before generic cliente/producto and before generic sales)
    const wantsRanking = hasToken('mejor', 'mejores', 'top', 'ranking', 'principal', 'principales')
      || (hasToken('mas', 'más') && hasToken('compra', 'compran', 'comprador', 'compradores'));
    const wantsBestSelling =
      hasToken('mas', 'más', 'vendido', 'vendidos') && hasToken('producto', 'productos');
    if (
      (wantsRanking &&
        hasToken('cliente', 'clientes', 'comprador', 'compradores', 'producto', 'productos')) ||
      wantsBestSelling
    ) {
      const wantsProduct = wantsBestSelling || hasToken('producto', 'productos');
      if (wantsProduct) {
        const top = await this.prisma.transactionItem.groupBy({
          by: ['productId'],
          where: { tenantId },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        });
        if (!top.length) return { answer: 'Aún no hay ventas registradas para calcular un ranking de productos.', teaser: false };
        const topProductIds = top.map((t) => t.productId).filter((x): x is string => !!x);
        const products = await this.prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true },
        });
        const nameMap = new Map(products.map((p) => [p.id, p.name]));
        const names = top
          .filter((t) => t.productId)
          .map((t) => `${nameMap.get(t.productId as string) || t.productId} (${Number(t._sum.quantity ?? 0)} und)`);
        return { answer: `Tus mejores productos: ${names.join(', ')}.`, teaser: false };
      }
      const top = await this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: { tenantId, status: { not: 'cancelled' } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      });
      if (!top.length) return { answer: 'Aún no hay facturas para calcular un ranking de clientes.', teaser: false };
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: top.map((t) => t.customerId) } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(customers.map((c) => [c.id, c.name]));
      const names = top.map((t) => `${nameMap.get(t.customerId) || 'Cliente'} (${fmt(t._sum.total ?? 0)})`);
      return { answer: `Tus mejores clientes: ${names.join(', ')}.`, teaser: false };
    }

    // Sales / invoicing branch — include vender/vendi/vendido synonyms
    if (hasToken('venta', 'ventas', 'vender', 'vendi', 'vendí', 'vendido', 'vendida', 'vendimos', 'factura', 'facturas', 'facturado', 'facturacion', 'facturación', 'cobrar', 'cobrado')) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const agg = await this.prisma.invoice.aggregate({
        where: { tenantId, status: { not: 'cancelled' }, createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _count: true,
      });
      return { answer: `Has facturado ${fmt(agg._sum.total || 0)} en ${agg._count} facturas este mes.`, teaser: false };
    }
    if (hasToken('cliente', 'clientes')) {
      const count = await this.prisma.customer.count({ where: { tenantId } });
      return { answer: `Tienes ${count} cliente(s) registrado(s).`, teaser: false };
    }
    if (hasToken('producto', 'productos', 'catalogo', 'catálogo')) {
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
