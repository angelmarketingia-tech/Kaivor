import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  /** Métricas en vivo del día para el header del POS (ventas, # tickets, ticket promedio). */
  async liveStats(tenantId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const agg = await this.prisma.invoice.aggregate({
      where: { tenantId, createdAt: { gte: startOfDay }, status: { not: 'cancelled' } },
      _sum: { total: true },
      _count: true,
    });
    const count = agg._count || 0;
    const revenue = agg._sum.total || 0;
    return {
      today: {
        revenue,
        invoices: count,
        avgTicket: count > 0 ? Math.round(revenue / count) : 0,
      },
    };
  }

  /** Analítica de ventas para el dashboard ejecutivo visual. */
  async salesAnalytics(tenantId: string, days = 30) {
    const now = new Date();
    const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, createdAt: { gte: startRange }, status: { not: 'cancelled' } },
      select: { total: true, createdAt: true, transactionId: true },
    });

    // Helpers de zona horaria: bucketizamos por America/Bogota (no por la hora local del servidor).
    const TZ = 'America/Bogota';
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }); // YYYY-MM-DD
    const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false, weekday: 'short' });
    const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const bogotaParts = (d: Date) => {
      let hour = 0;
      let weekdayIdx = 0;
      for (const p of partsFmt.formatToParts(d)) {
        if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
        else if (p.type === 'weekday') weekdayIdx = WEEKDAY_INDEX[p.value] ?? 0;
      }
      return { hour, weekdayIdx };
    };

    // Serie diaria (claves YYYY-MM-DD en hora Bogotá)
    const dailyMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startRange.getFullYear(), startRange.getMonth(), startRange.getDate() + i);
      dailyMap.set(dateFmt.format(d), { revenue: 0, count: 0 });
    }
    // Ventas por hora del día (heatmap de horas pico) y por día de semana
    const hourly = new Array(24).fill(0);
    const weekday = new Array(7).fill(0); // 0=domingo
    let totalRevenue = 0;
    for (const inv of invoices) {
      const createdAt = new Date(inv.createdAt);
      const day = dateFmt.format(createdAt);
      const e = dailyMap.get(day);
      if (e) { e.revenue += inv.total; e.count += 1; }
      const { hour, weekdayIdx } = bogotaParts(createdAt);
      hourly[hour] += inv.total;
      weekday[weekdayIdx] += inv.total;
      totalRevenue += inv.total;
    }
    const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }));

    // Top productos (por ingreso) en el rango
    const txnIds = invoices.map((i) => i.transactionId).filter(Boolean) as string[];
    let topProducts: { name: string; qty: number; revenue: number }[] = [];
    if (txnIds.length) {
      const items = await this.prisma.transactionItem.findMany({
        where: { transactionId: { in: txnIds } },
        include: { product: { select: { name: true } } },
      });
      const agg = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const it of items as any[]) {
        const name = it.product?.name || 'Otro';
        const cur = agg.get(name) || { name, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity) || 0;
        cur.revenue += Number(it.lineTotal) || 0;
        agg.set(name, cur);
      }
      topProducts = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    }

    const peakHour = hourly.indexOf(Math.max(...hourly));
    const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const peakDay = weekday.indexOf(Math.max(...weekday));

    return {
      rangeDays: days,
      totalRevenue,
      totalInvoices: invoices.length,
      avgTicket: invoices.length ? Math.round(totalRevenue / invoices.length) : 0,
      daily,
      hourly: hourly.map((revenue, hour) => ({ hour, revenue })),
      weekday: weekday.map((revenue, idx) => ({ day: WEEKDAYS[idx], revenue })),
      topProducts,
      insights: {
        peakHour,
        peakHourLabel: `${peakHour}:00 - ${peakHour + 1}:00`,
        peakDay: WEEKDAYS[peakDay] || '—',
      },
    };
  }

  /**
   * Sugerencias accionables calculadas desde la BD (sin LLM externo en v1).
   * slow movers, top performers, combo por co-ocurrencia y alertas de stock.
   */
  async suggestions(tenantId: string) {
    const now = new Date();
    const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

    // Ítems vendidos en el rango (transacciones de venta no canceladas).
    const items = await this.prisma.transactionItem.findMany({
      where: {
        tenantId,
        transaction: { type: 'sale', status: { not: 'cancelled' }, createdAt: { gte: startRange } },
      },
      select: { productId: true, transactionId: true, quantity: true, lineTotal: true },
    });

    // Agregados por producto: revenue, qty y set de productos vendidos.
    const perProduct = new Map<string, { qty: number; revenue: number }>();
    const txnProducts = new Map<string, Set<string>>(); // transactionId -> productIds
    for (const it of items) {
      if (!it.productId) continue; // ítems custom sin producto del catálogo no cuentan para sugerencias
      const cur = perProduct.get(it.productId) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity) || 0;
      cur.revenue += Number(it.lineTotal) || 0;
      perProduct.set(it.productId, cur);

      let set = txnProducts.get(it.transactionId);
      if (!set) { set = new Set(); txnProducts.set(it.transactionId, set); }
      set.add(it.productId);
    }
    const soldProductIds = new Set(perProduct.keys());

    // Productos activos del tenant (una sola consulta).
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, price: true, createdAt: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    // slowMovers: activos con CERO ventas en los últimos 30 días.
    const slowMovers = products
      .filter((p) => !soldProductIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        daysSinceCreated: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86400000),
      }))
      .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated)
      .slice(0, 5);

    // topPerformers: por ingreso en los últimos 30 días. Solo productos que aún existen (con nombre).
    const topPerformers = Array.from(perProduct.entries())
      .filter(([id]) => productById.has(id))
      .map(([id, v]) => ({ name: productById.get(id)!.name, revenue: Math.round(v.revenue), qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // comboSuggestion: par de productos más vendido en la MISMA transacción (co-ocurrencia).
    const pairCount = new Map<string, number>();
    for (const set of txnProducts.values()) {
      const ids = Array.from(set);
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join('|');
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    }
    let comboSuggestion: { a: string; b: string; count: number } | null = null;
    if (pairCount.size) {
      let bestKey = '';
      let bestCount = 0;
      for (const [key, count] of pairCount.entries()) {
        if (count > bestCount) { bestCount = count; bestKey = key; }
      }
      if (bestCount >= 2) {
        const [aId, bId] = bestKey.split('|');
        comboSuggestion = {
          a: productById.get(aId)?.name || 'Producto A',
          b: productById.get(bId)?.name || 'Producto B',
          count: bestCount,
        };
      }
    }

    // restockAlerts: inventario total por producto <= reorderPoint.
    const inventories = await this.prisma.inventory.findMany({
      where: { tenantId },
      select: { productId: true, quantity: true, reorderPoint: true },
    });
    const invByProduct = new Map<string, { stock: number; reorderPoint: number }>();
    for (const inv of inventories) {
      const cur = invByProduct.get(inv.productId) || { stock: 0, reorderPoint: Number(inv.reorderPoint) };
      cur.stock += Number(inv.quantity);
      // Usamos el mayor reorderPoint entre bodegas como referencia.
      cur.reorderPoint = Math.max(cur.reorderPoint, Number(inv.reorderPoint));
      invByProduct.set(inv.productId, cur);
    }
    const restockAlerts = Array.from(invByProduct.entries())
      .filter(([id, v]) => productById.has(id) && v.stock <= v.reorderPoint)
      .map(([id, v]) => ({ name: productById.get(id)?.name || 'Producto', stock: v.stock, reorderPoint: v.reorderPoint }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    // tips: strings accionables en español.
    const tips: string[] = [];
    for (const sm of slowMovers.slice(0, 2)) {
      tips.push(`El producto "${sm.name}" no se vende hace 30 días — considera una promo o destacarlo en el POS.`);
    }
    if (comboSuggestion) {
      tips.push(`"${comboSuggestion.a}" y "${comboSuggestion.b}" se venden juntos ${comboSuggestion.count} veces — crea un combo.`);
    }
    if (topPerformers[0]) {
      tips.push(`"${topPerformers[0].name}" es tu producto estrella ($${topPerformers[0].revenue} en 30 días) — asegúrate de tener stock.`);
    }
    for (const ra of restockAlerts.slice(0, 2)) {
      tips.push(`"${ra.name}" está en ${ra.stock} unidades (punto de reorden ${ra.reorderPoint}) — reabastece pronto.`);
    }

    return {
      rangeDays: 30,
      slowMovers,
      topPerformers,
      comboSuggestion,
      restockAlerts,
      tips,
    };
  }
}
