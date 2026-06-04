import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { InvoicesService } from '@/modules/invoices/invoices.service';

const TABLE_FIELDS = ['name', 'zone', 'seats', 'posX', 'posY', 'status'] as const;

const TABLE_STATUSES = ['free', 'occupied', 'bill_requested'] as const;
const ORDER_STATUSES = ['open', 'sent_to_kitchen', 'served', 'billed', 'cancelled'] as const;

function pickTable(data: any) {
  const out: any = {};
  for (const k of TABLE_FIELDS) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  if (out.seats !== undefined) out.seats = Number(out.seats) || 0;
  if (out.posX !== undefined) out.posX = Number(out.posX) || 0;
  if (out.posY !== undefined) out.posY = Number(out.posY) || 0;
  if (out.status !== undefined && !TABLE_STATUSES.includes(out.status)) {
    throw new BadRequestException('Estado de mesa inválido');
  }
  return out;
}

function normalizeItems(items: any): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => ({
    name: typeof it?.name === 'string' ? it.name : '',
    qty: Number(it?.qty) || 0,
    unitPrice: Number(it?.unitPrice) || 0,
    notes: it?.notes ?? undefined,
    sentToKitchen: it?.sentToKitchen ?? false,
  }));
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
        seats: fields.seats ?? 0,
        posX: fields.posX ?? 0,
        posY: fields.posY ?? 0,
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
      data: { status: 'occupied' },
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
      data.items = items;
      data.subtotal = computeSubtotal(items);
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

    // Idempotencia: si ya tiene factura, no volver a cobrar.
    if (order.invoiceId) {
      throw new BadRequestException('Esta orden ya fue facturada.');
    }

    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    if (items.length === 0) {
      // Orden vacía: solo liberar la mesa, sin factura.
      await this.prisma.tableOrder.update({ where: { id: order.id }, data: { status: 'cancelled', closedAt: new Date() } });
      await this.prisma.restaurantTable.update({ where: { id }, data: { status: 'free' } });
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

    const invoice = await this.invoices.createInvoice(invoicePayload, tenantId);

    await this.prisma.tableOrder.update({
      where: { id: order.id },
      data: { status: 'billed', closedAt: new Date(), invoiceId: invoice.id },
    });
    await this.prisma.restaurantTable.update({ where: { id }, data: { status: 'free' } });

    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNumber: (invoice as any).invoiceNumber,
      total: (invoice as any).total,
    };
  }
}
