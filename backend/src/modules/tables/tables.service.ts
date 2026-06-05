import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import * as crypto from 'crypto';

const TABLE_FIELDS = [
  'name', 'zone', 'areaId', 'shape', 'seats', 'posX', 'posY',
  'width', 'height', 'rotation', 'status', 'assignedWaiter', 'metadata',
] as const;

// Estados ampliados del mapa vivo.
const TABLE_STATUSES = ['free', 'occupied', 'bill_requested', 'reserved', 'cleaning', 'blocked'] as const;
const TABLE_SHAPES = ['round', 'square', 'rect', 'bar', 'sofa'] as const;
const ORDER_STATUSES = ['open', 'sent_to_kitchen', 'served', 'billed', 'cancelled', 'billing'] as const;

const INT_FIELDS = ['seats', 'posX', 'posY', 'width', 'height', 'rotation'] as const;

function pickTable(data: any) {
  const out: any = {};
  for (const k of TABLE_FIELDS) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  for (const k of INT_FIELDS) {
    if (out[k] !== undefined) out[k] = Math.round(Number(out[k])) || 0;
  }
  if (out.status !== undefined && !TABLE_STATUSES.includes(out.status)) {
    throw new BadRequestException('Estado de mesa inválido');
  }
  if (out.shape !== undefined && !TABLE_SHAPES.includes(out.shape)) {
    throw new BadRequestException('Forma de mesa inválida');
  }
  return out;
}

function normalizeItems(items: any): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it: any) => ({
      productId: typeof it?.productId === 'string' ? it.productId : undefined,
      name: typeof it?.name === 'string' ? it.name : '',
      qty: Math.max(0, Math.min(999, Math.round(Number(it?.qty) || 0))),
      unitPrice: Math.max(0, Math.round(Number(it?.unitPrice) || 0)),
      notes: typeof it?.notes === 'string' ? it.notes.slice(0, 200) : undefined,
      sentToKitchen: it?.sentToKitchen ?? false,
      byCustomer: it?.byCustomer ?? false,
    }))
    // descarta líneas vacías (sin nombre ni producto, o qty 0) para no crear ítems fantasma
    .filter((it) => (it.productId || it.name) && it.qty > 0);
}

function computeSubtotal(items: any[]): number {
  return items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
}

@Injectable()
export class TablesService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
  ) {}

  async list(tenantId: string) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        orders: {
          where: { status: { notIn: ['billed', 'cancelled'] } },
          orderBy: { openedAt: 'desc' },
          take: 1,
        },
      },
    });
    return {
      tables: tables.map((t) => {
        const { orders, ...rest } = t as any;
        return { ...rest, currentOrder: (orders && orders[0]) || null };
      }),
    };
  }

  async create(tenantId: string, data: any) {
    const fields = pickTable(data);
    const name = typeof fields.name === 'string' ? fields.name.trim() : '';
    if (!name) throw new BadRequestException('El nombre de la mesa es requerido');
    return this.prisma.restaurantTable.create({
      data: {
        tenantId,
        name,
        zone: fields.zone,
        areaId: fields.areaId ?? null,
        shape: fields.shape ?? 'round',
        seats: fields.seats ?? 4,
        posX: fields.posX ?? 0,
        posY: fields.posY ?? 0,
        width: fields.width ?? 72,
        height: fields.height ?? 72,
        rotation: fields.rotation ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Mesa no encontrada');
    const fields = pickTable(data);
    return this.prisma.restaurantTable.update({ where: { id }, data: fields });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Mesa no encontrada');
    // Borrar alertas de la mesa primero (el FK cascade no se aplicó en la migración manual).
    await this.prisma.tableCall.deleteMany({ where: { tenantId, tableId: id } });
    await this.prisma.restaurantTable.delete({ where: { id } });
    return { ok: true };
  }

  async openOrder(tenantId: string, id: string, body: any) {
    const table = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');

    const existing = await this.prisma.tableOrder.findFirst({
      where: { tenantId, tableId: id, status: { notIn: ['billed', 'cancelled'] } },
      orderBy: { openedAt: 'desc' },
    });
    if (existing) return existing;

    const order = await this.prisma.tableOrder.create({
      data: {
        tenantId,
        tableId: id,
        status: 'open',
        items: [],
        subtotal: 0,
        waiter: typeof body?.waiter === 'string' ? body.waiter : undefined,
      },
    });
    await this.prisma.restaurantTable.update({
      where: { id },
      data: {
        status: 'occupied',
        occupiedSince: new Date(),
        assignedWaiter: typeof body?.waiter === 'string' ? body.waiter : undefined,
      },
    });
    return order;
  }

  async updateOrder(tenantId: string, id: string, body: any) {
    const table = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');

    const order = await this.prisma.tableOrder.findFirst({
      where: { tenantId, tableId: id, status: { notIn: ['billed', 'cancelled'] } },
      orderBy: { openedAt: 'desc' },
    });
    if (!order) throw new NotFoundException('No hay una orden abierta para esta mesa');

    const data: any = {};

    if (body?.items !== undefined) {
      const items = normalizeItems(body.items);
      // SEGURIDAD (anti-fraude de precio): para ítems con productId, el precio y nombre
      // se toman del CATÁLOGO del tenant, nunca del valor enviado por el cliente.
      const pids = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
      if (pids.length) {
        const prods = await this.prisma.product.findMany({
          where: { id: { in: pids }, tenantId }, select: { id: true, name: true, price: true },
        });
        const byId = new Map(prods.map((p) => [p.id, p]));
        for (const it of items) {
          if (it.productId) {
            const p = byId.get(it.productId);
            if (!p) throw new BadRequestException('Uno o más productos no pertenecen a este negocio');
            it.unitPrice = Math.round(p.price); // precio real del catálogo
            if (!it.name) it.name = p.name;
          }
        }
      }

      // MERGE anti-pérdida (carrera mesero↔cliente): un PATCH del mesero NO debe borrar
      // ítems que el CLIENTE pidió por QR (byCustomer) y que ya están en la orden actual,
      // salvo que el propio PATCH los incluya. Se reanexan los pedidos del cliente ausentes.
      const current = Array.isArray(order.items) ? (order.items as any[]) : [];
      const incomingKeys = new Set(items.map((i) => `${i.productId || i.name}|${i.unitPrice}`));
      const preservedCustomer = current.filter(
        (c) => c.byCustomer && !incomingKeys.has(`${c.productId || c.name}|${c.unitPrice}`),
      );
      const finalItems = [...items, ...preservedCustomer];

      data.items = finalItems;
      data.subtotal = computeSubtotal(finalItems);
    }

    if (body?.notes !== undefined) data.notes = body.notes;

    // 'bill_requested' is a table status (not a valid order status): it flags the
    // table as awaiting its bill while leaving the order itself untouched.
    let billRequested = false;
    if (body?.status !== undefined) {
      if (body.status === 'bill_requested') {
        billRequested = true;
      } else if (!ORDER_STATUSES.includes(body.status)) {
        throw new BadRequestException('Estado de orden inválido');
      } else {
        data.status = body.status;
      }
    }

    // Al ENVIAR A COCINA, marca los ítems como enviados (la cocina los verá en el KDS).
    if (data.status === 'sent_to_kitchen') {
      const current = data.items ?? (Array.isArray(order.items) ? order.items : []);
      data.items = (current as any[]).map((it) => ({ ...it, sentToKitchen: true }));
      data.subtotal = computeSubtotal(data.items);
    }

    const updated = await this.prisma.tableOrder.update({
      where: { id: order.id },
      data,
    });

    if (billRequested) {
      await this.prisma.restaurantTable.update({
        where: { id },
        data: { status: 'bill_requested' },
      });
    }

    return updated;
  }

  /**
   * Cierra la mesa: crea la factura desde los items de la orden (fuente única de verdad),
   * la enlaza a la orden, marca billed y libera la mesa. Idempotente: si la orden ya tiene
   * factura, no crea otra.
   */
  async close(tenantId: string, id: string, body: any, userId?: string) {
    const table = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');

    const order = await this.prisma.tableOrder.findFirst({
      where: { tenantId, tableId: id, status: { notIn: ['billed', 'cancelled'] } },
      orderBy: { openedAt: 'desc' },
    });
    if (!order) throw new NotFoundException('No hay una orden abierta para esta mesa');

    // CLAIM ATÓMICO anti doble-cobro (TOCTOU): marca la orden como 'billing' SOLO si
    // sigue abierta y sin factura. Si dos cierres llegan a la vez, únicamente UNO
    // obtiene count===1; el otro recibe 0 y se rechaza. Evita 2 facturas por mesa.
    const claim = await this.prisma.tableOrder.updateMany({
      where: { id: order.id, invoiceId: null, status: { notIn: ['billed', 'cancelled', 'billing'] } },
      data: { status: 'billing' },
    });
    if (claim.count !== 1) {
      throw new BadRequestException('Esta orden ya se está cobrando o ya fue facturada.');
    }

    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    if (items.length === 0) {
      // Orden vacía: solo liberar la mesa, sin factura (revierte el claim a cancelled).
      await this.prisma.tableOrder.update({ where: { id: order.id }, data: { status: 'cancelled', closedAt: new Date() } });
      await this.prisma.restaurantTable.update({ where: { id }, data: { status: 'free', occupiedSince: null, assignedWaiter: null } });
      await this.prisma.tableCall.updateMany({ where: { tenantId, tableId: id, status: 'pending' }, data: { status: 'attended', attendedAt: new Date() } });
      return { ok: true, invoiceId: null, note: 'Orden vacía cerrada sin factura.' };
    }

    // Crear la factura reusando la lógica central (numeración atómica, totales, pago).
    // Si viene cash sin monto recibido, asumimos pago exacto (el mesero cobra el total).
    const payMethod = body?.paymentMethod || 'cash';
    const invoicePayload: any = {
      items: items.map((it) => ({
        description: it.name || 'Ítem',
        quantity: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        taxRate: Number(it.taxRate) || 0,
        discountType: 'percent',
        discountValue: 0,
      })),
      paymentMethod: payMethod,
      tipAmount: body?.tipAmount,
      serviceCharge: body?.serviceCharge,
      tableNumber: table.name,
      notes: order.notes || undefined,
      userId, // mesero/cajero que cierra la cuenta
      professional: order.waiter || undefined,
    };
    if (payMethod === 'cash') {
      invoicePayload.cashReceived = body?.cashReceived;
    }

    let invoice: any;
    try {
      invoice = await this.invoices.createInvoice(invoicePayload, tenantId);
    } catch (err) {
      // Si la factura falla, REVERTIR el claim para que la mesa pueda reintentar cobrar.
      await this.prisma.tableOrder.update({ where: { id: order.id }, data: { status: 'open' } }).catch(() => null);
      throw err;
    }

    await this.prisma.tableOrder.update({
      where: { id: order.id },
      data: { status: 'billed', closedAt: new Date(), invoiceId: invoice.id },
    });
    await this.prisma.restaurantTable.update({
      where: { id },
      data: { status: 'free', occupiedSince: null, assignedWaiter: null },
    });
    // Cerrar alertas pendientes de la mesa (no dejar 'zombis' tras cobrar).
    await this.prisma.tableCall.updateMany({
      where: { tenantId, tableId: id, status: 'pending' },
      data: { status: 'attended', attendedAt: new Date() },
    });

    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNumber: (invoice as any).invoiceNumber,
      total: (invoice as any).total,
    };
  }

  // ── Unir mesas / dividir cuenta ──

  /**
   * UNIR mesas: combina las órdenes abiertas de varias mesas en la mesa destino.
   * Los ítems se concatenan en la orden destino; las mesas origen quedan libres.
   * Útil cuando un grupo grande junta varias mesas.
   */
  async mergeTables(tenantId: string, body: any) {
    const targetId = String(body?.targetId || '');
    const sourceIds = Array.isArray(body?.sourceIds) ? body.sourceIds.map(String).filter((s: string) => s && s !== targetId) : [];
    if (!targetId || sourceIds.length === 0) throw new BadRequestException('Indica la mesa destino y al menos una mesa a unir');

    const target = await this.prisma.restaurantTable.findFirst({ where: { id: targetId, tenantId } });
    if (!target) throw new NotFoundException('Mesa destino no encontrada');

    // Orden destino (crear si no hay).
    let targetOrder = await this.prisma.tableOrder.findFirst({
      where: { tenantId, tableId: targetId, status: { notIn: ['billed', 'cancelled'] } },
      orderBy: { openedAt: 'desc' },
    });
    let mergedItems = targetOrder && Array.isArray(targetOrder.items) ? [...(targetOrder.items as any[])] : [];

    for (const sid of sourceIds) {
      const src = await this.prisma.restaurantTable.findFirst({ where: { id: sid, tenantId } });
      if (!src) continue;
      const srcOrder = await this.prisma.tableOrder.findFirst({
        where: { tenantId, tableId: sid, status: { notIn: ['billed', 'cancelled'] } },
        orderBy: { openedAt: 'desc' },
      });
      if (srcOrder) {
        const its = Array.isArray(srcOrder.items) ? (srcOrder.items as any[]) : [];
        mergedItems = [...mergedItems, ...its];
        // cancelar la orden origen (sus ítems ya viven en la destino)
        await this.prisma.tableOrder.update({ where: { id: srcOrder.id }, data: { status: 'cancelled', closedAt: new Date(), notes: `Unida a ${target.name}` } });
      }
      // liberar la mesa origen
      await this.prisma.restaurantTable.update({ where: { id: sid }, data: { status: 'free', occupiedSince: null, assignedWaiter: null } });
    }

    const subtotal = computeSubtotal(mergedItems);
    if (!targetOrder) {
      targetOrder = await this.prisma.tableOrder.create({ data: { tenantId, tableId: targetId, status: 'open', items: mergedItems, subtotal, waiter: target.assignedWaiter || undefined } });
    } else {
      await this.prisma.tableOrder.update({ where: { id: targetOrder.id }, data: { items: mergedItems, subtotal } });
    }
    await this.prisma.restaurantTable.update({ where: { id: targetId }, data: { status: 'occupied', occupiedSince: target.occupiedSince ?? new Date() } });
    return { ok: true, targetId, merged: sourceIds.length, items: mergedItems.length, subtotal };
  }

  /**
   * DIVIDIR CUENTA: separa ítems de la orden de una mesa en una factura aparte
   * (cobra esos ítems ya) y deja el resto en la mesa. itemIndexes = posiciones a cobrar.
   */
  async splitBill(tenantId: string, id: string, body: any, userId?: string) {
    const table = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    const order = await this.prisma.tableOrder.findFirst({
      where: { tenantId, tableId: id, status: { notIn: ['billed', 'cancelled'] } },
      orderBy: { openedAt: 'desc' },
    });
    if (!order) throw new NotFoundException('No hay una orden abierta para esta mesa');

    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    const idxs: number[] = Array.isArray(body?.itemIndexes) ? body.itemIndexes.map(Number).filter((n: number) => n >= 0 && n < items.length) : [];
    if (idxs.length === 0) throw new BadRequestException('Selecciona los ítems a cobrar por separado');

    const toBill = idxs.map((i) => items[i]);
    const remaining = items.filter((_, i) => !idxs.includes(i));
    if (toBill.length === 0) throw new BadRequestException('No hay ítems válidos para cobrar');

    // Factura del subconjunto (reusa la lógica central).
    const payMethod = body?.paymentMethod || 'cash';
    const invoicePayload: any = {
      items: toBill.map((it) => ({ description: it.name || 'Ítem', quantity: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, taxRate: 0, discountType: 'percent', discountValue: 0 })),
      paymentMethod: payMethod,
      tableNumber: table.name,
      userId,
      professional: order.waiter || undefined,
    };
    if (payMethod === 'cash') invoicePayload.cashReceived = body?.cashReceived;
    const invoice: any = await this.invoices.createInvoice(invoicePayload, tenantId);

    // Dejar el resto en la mesa. Si no queda nada, la orden se cierra y la mesa se libera.
    if (remaining.length === 0) {
      await this.prisma.tableOrder.update({ where: { id: order.id }, data: { status: 'billed', closedAt: new Date(), invoiceId: invoice.id } });
      await this.prisma.restaurantTable.update({ where: { id }, data: { status: 'free', occupiedSince: null, assignedWaiter: null } });
      await this.prisma.tableCall.updateMany({ where: { tenantId, tableId: id, status: 'pending' }, data: { status: 'attended', attendedAt: new Date() } });
    } else {
      await this.prisma.tableOrder.update({ where: { id: order.id }, data: { items: remaining, subtotal: computeSubtotal(remaining) } });
    }
    return { ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, billed: toBill.length, remaining: remaining.length };
  }

  // ── Mapa vivo: posición, estado, zonas, layout, resumen ──

  /** Actualiza solo la posición/tamaño/rotación de una mesa (drag en modo edición). */
  async updatePosition(tenantId: string, id: string, body: any) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Mesa no encontrada');
    const data: any = {};
    for (const k of ['posX', 'posY', 'width', 'height', 'rotation'] as const) {
      if (body[k] !== undefined) data[k] = Math.round(Number(body[k])) || 0;
    }
    if (body.areaId !== undefined) data.areaId = body.areaId || null;
    return this.prisma.restaurantTable.update({ where: { id }, data });
  }

  /** Cambia el estado de una mesa (free/occupied/reserved/cleaning/blocked/bill_requested). */
  async setStatus(tenantId: string, id: string, status: string, body?: any) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Mesa no encontrada');
    if (!TABLE_STATUSES.includes(status as any)) throw new BadRequestException('Estado inválido');
    const data: any = { status };
    if (status === 'occupied' && !existing.occupiedSince) data.occupiedSince = new Date();
    if (status === 'free') { data.occupiedSince = null; data.assignedWaiter = null; }
    if (body?.assignedWaiter !== undefined) data.assignedWaiter = body.assignedWaiter || null;
    return this.prisma.restaurantTable.update({ where: { id }, data });
  }

  // ── Zonas (RestaurantArea) ──
  async listAreas(tenantId: string) {
    const areas = await this.prisma.restaurantArea.findMany({ where: { tenantId }, orderBy: { order: 'asc' } });
    return { areas };
  }

  async createArea(tenantId: string, body: any) {
    const name = (body?.name || '').trim();
    if (!name) throw new BadRequestException('El nombre de la zona es requerido');
    const count = await this.prisma.restaurantArea.count({ where: { tenantId } });
    return this.prisma.restaurantArea.create({
      data: { tenantId, name, color: body?.color || '#A3CC39', order: body?.order ?? count },
    });
  }

  async updateArea(tenantId: string, id: string, body: any) {
    const existing = await this.prisma.restaurantArea.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Zona no encontrada');
    const data: any = {};
    if (body?.name !== undefined) data.name = String(body.name).trim();
    if (body?.color !== undefined) data.color = body.color;
    if (body?.order !== undefined) data.order = Number(body.order) || 0;
    return this.prisma.restaurantArea.update({ where: { id }, data });
  }

  async deleteArea(tenantId: string, id: string) {
    const existing = await this.prisma.restaurantArea.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Zona no encontrada');
    // No se borra si tiene mesas; se desvinculan (areaId -> null) para no perder mesas.
    await this.prisma.restaurantTable.updateMany({ where: { tenantId, areaId: id }, data: { areaId: null } });
    await this.prisma.restaurantArea.delete({ where: { id } });
    return { ok: true };
  }

  // ── Layout: guardar/cargar/duplicar/restablecer la distribución ──
  async getLayout(tenantId: string) {
    const [areas, tables, active] = await Promise.all([
      this.prisma.restaurantArea.findMany({ where: { tenantId }, orderBy: { order: 'asc' } }),
      this.prisma.restaurantTable.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.tableLayoutVersion.findFirst({ where: { tenantId, isActive: true }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { areas, tables, activeVersion: active || null };
  }

  /** Guarda un snapshot del layout actual como versión (y aplica posiciones recibidas). */
  async saveLayout(tenantId: string, body: any) {
    // Aplica posiciones de mesas recibidas (batch) para persistir el arrastre.
    const tables = Array.isArray(body?.tables) ? body.tables : [];
    for (const t of tables) {
      if (!t?.id) continue;
      const owned = await this.prisma.restaurantTable.findFirst({ where: { id: t.id, tenantId }, select: { id: true } });
      if (!owned) continue;
      await this.prisma.restaurantTable.update({
        where: { id: t.id },
        data: {
          posX: Math.round(Number(t.posX ?? t.x)) || 0,
          posY: Math.round(Number(t.posY ?? t.y)) || 0,
          width: t.width !== undefined ? Math.round(Number(t.width)) || 72 : undefined,
          height: t.height !== undefined ? Math.round(Number(t.height)) || 72 : undefined,
          rotation: t.rotation !== undefined ? Math.round(Number(t.rotation)) || 0 : undefined,
          areaId: t.areaId !== undefined ? (t.areaId || null) : undefined,
        },
      });
    }
    // Snapshot de versión.
    const snapshot = await this.getLayout(tenantId);
    await this.prisma.tableLayoutVersion.updateMany({ where: { tenantId, isActive: true }, data: { isActive: false } });
    const version = await this.prisma.tableLayoutVersion.create({
      data: {
        tenantId,
        name: (body?.name || 'Distribución').toString(),
        layoutJson: { areas: snapshot.areas, tables: snapshot.tables } as any,
        isActive: true,
      },
    });
    return { ok: true, versionId: version.id, savedTables: tables.length };
  }

  // ── Resumen operativo (panel superior del mapa) ──
  async summary(tenantId: string) {
    const tables = await this.prisma.restaurantTable.findMany({ where: { tenantId } });
    const openOrders = await this.prisma.tableOrder.findMany({
      where: { tenantId, status: { notIn: ['billed', 'cancelled'] } },
    });
    const byStatus = (s: string) => tables.filter((t) => t.status === s).length;
    const totalOpen = openOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
    // Tiempo promedio de ocupación (min) de las mesas con occupiedSince.
    const occ = tables.filter((t) => t.occupiedSince);
    const now = Date.now();
    const avgMin = occ.length
      ? Math.round(occ.reduce((s, t) => s + (now - new Date(t.occupiedSince as any).getTime()) / 60000, 0) / occ.length)
      : 0;
    return {
      total: tables.length,
      free: byStatus('free'),
      occupied: byStatus('occupied'),
      billRequested: byStatus('bill_requested'),
      reserved: byStatus('reserved'),
      cleaning: byStatus('cleaning'),
      blocked: byStatus('blocked'),
      openOrders: openOrders.length,
      totalOpen,
      avgOccupationMin: avgMin,
    };
  }

  // ── QR público del cliente + alertas (TableCall) ──

  /** Devuelve (creando si hace falta) el token público de la mesa para armar el QR. */
  async getPublicToken(tenantId: string, id: string) {
    const table = await this.prisma.restaurantTable.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    let token = table.publicToken;
    if (!token) {
      token = crypto.randomBytes(12).toString('base64url'); // opaco, no expone el id
      await this.prisma.restaurantTable.update({ where: { id }, data: { publicToken: token } });
    }
    return { tableId: id, name: table.name, publicToken: token, path: `/mesa/${token}` };
  }

  /** Alertas pendientes del comensal (llamar mesero / pedir cuenta) para el panel del mesero. */
  async listCalls(tenantId: string) {
    const calls = await this.prisma.tableCall.findMany({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    // Resolver nombres de mesa por separado (evita depender del include/relación).
    const tableIds = [...new Set(calls.map((c) => c.tableId))];
    const tables = tableIds.length
      ? await this.prisma.restaurantTable.findMany({ where: { id: { in: tableIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(tables.map((t) => [t.id, t.name]));
    return {
      calls: calls.map((c) => ({ id: c.id, tableId: c.tableId, tableName: nameById.get(c.tableId) || 'Mesa', type: c.type, note: c.note, createdAt: c.createdAt })),
      count: calls.length,
    };
  }

  /** El mesero marca una alerta como atendida. */
  async attendCall(tenantId: string, callId: string) {
    const call = await this.prisma.tableCall.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw new NotFoundException('Alerta no encontrada');
    await this.prisma.tableCall.update({ where: { id: callId }, data: { status: 'attended', attendedAt: new Date() } });
    return { ok: true };
  }

  // ── KDS: pantalla de cocina ──

  /** Comandas activas para la cocina: órdenes enviadas a cocina, con sus ítems y la mesa. */
  async kitchenOrders(tenantId: string) {
    const orders = await this.prisma.tableOrder.findMany({
      where: { tenantId, status: 'sent_to_kitchen' },
      orderBy: { openedAt: 'asc' }, // las más antiguas primero (FIFO de cocina)
    });
    const tableIds = [...new Set(orders.map((o) => o.tableId))];
    const tables = tableIds.length
      ? await this.prisma.restaurantTable.findMany({ where: { id: { in: tableIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(tables.map((t) => [t.id, t.name]));
    const now = Date.now();
    return {
      orders: orders.map((o) => {
        const items = Array.isArray(o.items) ? (o.items as any[]) : [];
        return {
          orderId: o.id,
          tableId: o.tableId,
          tableName: nameById.get(o.tableId) || 'Mesa',
          waiter: o.waiter || null,
          notes: o.notes || null,
          openedAt: o.openedAt,
          waitingMin: Math.round((now - new Date(o.openedAt).getTime()) / 60000),
          items: items.map((it) => ({ name: it.name, qty: Number(it.qty) || 0, notes: it.notes || null, byCustomer: !!it.byCustomer })),
        };
      }),
      count: orders.length,
    };
  }

  /** La cocina marca una comanda como LISTA → orden 'served' + alerta al mesero ('ready'). */
  async markReady(tenantId: string, orderId: string) {
    const order = await this.prisma.tableOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Comanda no encontrada');
    if (order.status !== 'sent_to_kitchen') {
      // idempotente / fuera de estado: no rompe, solo informa.
      return { ok: true, alreadyDone: true };
    }
    await this.prisma.tableOrder.update({ where: { id: orderId }, data: { status: 'served' } });
    // Detalle del pedido listo para que el mesero sepa QUÉ recoger (no solo "listo").
    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    const detail = items
      .filter((it) => it && (it.name || it.productId) && (Number(it.qty) || 0) > 0)
      .map((it) => `${Number(it.qty) || 1}× ${it.name || 'Ítem'}${it.notes ? ` (${String(it.notes).slice(0, 60)})` : ''}`)
      .join(', ')
      .slice(0, 480);
    const note = detail ? `Pedido listo: ${detail}` : 'Pedido listo en cocina';
    // Notifica al mesero que el pedido de esa mesa está listo para recoger, con el detalle.
    await this.prisma.tableCall.create({
      data: { tenantId, tableId: order.tableId, type: 'ready', note },
    }).catch(() => null);
    return { ok: true };
  }
}
