import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  /** Cliente "Consumidor Final" del tenant para ventas rápidas de POS sin cliente identificado. */
  private async getOrCreateWalkInCustomer(tenantId: string, companyId: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, taxId: 'CF-222222222222' },
    });
    if (existing) return existing;
    return this.prisma.customer.create({
      data: { tenantId, companyId, name: 'Consumidor Final', taxId: 'CF-222222222222' },
    });
  }

  async getInvoices(
    tenantId: string,
    companyId?: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const take = opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 1000) : 100;
    const skip = opts?.offset && opts.offset > 0 ? opts.offset : undefined;
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true } } },
      take,
      skip,
    });
  }

  async getInvoice(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        payments: { orderBy: { paidAt: 'asc' } },
        customer: true,
        company: true,
        user: { select: { name: true } },
        transaction: { include: { items: { include: { product: true } } } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    // Activity logs (best-effort — never crash the detail page)
    const [printRows, messageRows] = await Promise.all([
      this.prisma.printLog
        .findMany({
          where: { tenantId, entity: 'invoice', entityId: id },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => [] as any[]),
      this.prisma.message
        .findMany({
          where: { tenantId, providerRef: id },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => [] as any[]),
    ]);

    // Derive the rich item shape the frontend reads from the transaction lines.
    const items = (invoice.transaction?.items ?? []).map((ti) => {
      const gross = ti.quantity * ti.unitPrice;
      const discountType = ti.discountType === 'fixed' ? 'fixed' : 'percent';
      // For 'fixed' discounts the stored discountPercent IS the absolute amount.
      const discAmt =
        discountType === 'fixed'
          ? (ti.discountPercent || 0)
          : (gross * (ti.discountPercent || 0)) / 100;
      const taxable = gross - discAmt;
      const taxAmount = (taxable * (ti.taxPercent || 0)) / 100;
      return {
        id: ti.id,
        description: ti.description || ti.product?.name || '',
        quantity: ti.quantity,
        unitPrice: ti.unitPrice,
        discountValue: ti.discountPercent || 0,
        discountType,
        taxRate: ti.taxPercent || 0,
        taxAmount,
        subtotal: gross,
        total: ti.lineTotal,
      };
    });

    // Derive payment info from the recorded payments.
    const payments = invoice.payments ?? [];
    const paidTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const paymentStatus =
      paidTotal <= 0 ? 'unpaid' : paidTotal >= invoice.total ? 'paid' : 'partial';
    const firstPayment = payments[0];
    // Prefer the persisted invoice.paymentMethod (covers addi/credit_validation which have no Payment row).
    const paymentMethod = (invoice as any).paymentMethod ?? firstPayment?.method ?? 'cash';
    let cashReceived: number | undefined;
    let changeGiven: number | undefined;
    if (paymentMethod === 'cash' && firstPayment) {
      cashReceived = firstPayment.cashReceived ?? firstPayment.amount ?? invoice.total;
      changeGiven =
        firstPayment.changeGiven ??
        (cashReceived > invoice.total ? cashReceived - invoice.total : 0);
    }

    const printLogs = printRows.map((p: any) => ({
      id: p.id,
      type: p.format === 'pdf' ? 'invoice' : 'receipt',
      paperSize: p.paperSize || (p.format === 'pdf' ? 'A4' : '80mm'),
      createdAt: p.createdAt,
    }));

    const deliveryLogs = messageRows.map((m: any) => ({
      id: m.id,
      channel: m.channel,
      destination: m.recipient,
      sentAt: m.createdAt,
    }));

    const { transaction, ...rest } = invoice;
    return {
      ...rest,
      items,
      paymentStatus,
      paymentMethod,
      cashReceived,
      changeGiven,
      printLogs,
      deliveryLogs,
    };
  }

  async createInvoice(data: any, tenantId: string) {
    // 1. Verificar límite del plan antes de crear
    await this.subscriptionsService.checkInvoiceLimit(tenantId);

    // 2. Resolver companyId si no viene
    let companyId = data.companyId;
    if (!companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
      if (!company) throw new NotFoundException('No hay empresa configurada para este tenant');
      companyId = company.id;
    }

    // Venta rápida (POS): si no viene customerId, usar/crear "Consumidor Final" del tenant.
    if (!data.customerId) {
      const sentinel = await this.getOrCreateWalkInCustomer(tenantId, companyId);
      data.customerId = sentinel.id;
    } else {
      // SEGURIDAD: el cliente DEBE pertenecer al tenant (evita escritura cross-tenant).
      const cust = await this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId }, select: { id: true } });
      if (!cust) throw new BadRequestException('Cliente no válido para este negocio');
    }

    // 3. Calcular totales a partir de items. Toda cifra monetaria se redondea a peso entero.
    const rawItems = Array.isArray(data.items) ? data.items : [];

    // SEGURIDAD: validar que todos los productId (si vienen) pertenezcan al tenant.
    const productIds = [...new Set(rawItems.map((i: any) => i.productId).filter(Boolean))] as string[];
    if (productIds.length) {
      const owned = await this.prisma.product.findMany({ where: { id: { in: productIds }, tenantId }, select: { id: true } });
      const ownedSet = new Set(owned.map((p) => p.id));
      const foreign = productIds.filter((id) => !ownedSet.has(id));
      if (foreign.length) throw new BadRequestException('Uno o más productos no pertenecen a este negocio');
    }

    const norm = this.computeTotals(rawItems, data);
    const { normItems, subtotal, taxAmount, discountAmount, tipAmount, serviceCharge, total } = norm;

    if (total <= 0) {
      throw new BadRequestException('La factura debe tener al menos un item con monto mayor a 0');
    }

    // 3c. Validación de pago en efectivo: lo recibido debe cubrir el total.
    const isCash = data.paymentMethod === 'cash';
    let cashReceived: number | null = null;
    if (isCash && data.cashReceived !== undefined && data.cashReceived !== null && data.cashReceived !== '') {
      cashReceived = Math.round(parseFloat(data.cashReceived) || 0);
      if (cashReceived < total) {
        throw new BadRequestException(`El efectivo recibido (${cashReceived}) es menor al total (${total}).`);
      }
    }

    // 4. invoiceNumber atómico por tenant (evita colisiones bajo concurrencia).
    // 5. Todo dentro de una transacción.
    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = data.invoiceNumber || (await this.nextInvoiceNumber(tx, tenantId));

      // 5a. Transaction (venta operativa) con TODOS los items (incluidos los custom sin productId).
      let transactionId: string | null = null;
      if (normItems.length) {
        const transaction = await tx.transaction.create({
          data: {
            tenantId, companyId,
            customerId: data.customerId,
            userId: data.userId || null,
            type: 'sale',
            total, taxAmount, discountAmount,
            status: 'completed',
            items: {
              create: normItems.map((i) => ({
                tenantId,
                productId: i.productId,
                description: i.description || null,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                discountPercent: i.discountValue,
                discountType: i.discountType,
                taxPercent: i.taxRate,
                lineTotal: i.lineTotal,
              })),
            },
          },
        });
        transactionId = transaction.id;

        // 5b. Decrementar inventario SOLO para productos físicos (no servicios) con stock registrado.
        for (const it of normItems) {
          if (!it.productId || it.isService) continue;
          const inv = await tx.inventory.findFirst({ where: { tenantId, productId: it.productId } });
          if (inv) {
            const dec = BigInt(Math.round(it.quantity));
            // Bloqueo de sobreventa salvo que el negocio permita stock negativo.
            if (!data.allowNegativeStock && inv.quantity - dec < 0n) {
              const prod = await tx.product.findUnique({ where: { id: it.productId }, select: { name: true } });
              throw new BadRequestException(
                `Stock insuficiente para "${prod?.name || it.description || 'producto'}": disponible ${inv.quantity}, solicitado ${dec}.`,
              );
            }
            await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: dec } } });
            await tx.inventoryMovement.create({
              data: { tenantId, inventoryId: inv.id, type: 'sale', quantity: -dec, reference: invoiceNumber },
            });
          }
        }
      }

      // 5c. Factura
      const inv = await tx.invoice.create({
        data: {
          tenantId, companyId,
          customerId: data.customerId,
          userId: data.userId || null,
          transactionId,
          invoiceNumber,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: data.status || 'draft',
          paymentMethod: data.paymentMethod || null,
          subtotal, taxAmount, discountAmount, tipAmount, serviceCharge, total,
          tableNumber: data.tableNumber || null,
          professional: data.professional || null,
          notes: data.notes || null,
        },
      });

      // 5d. Pago. Addi/credit_validation quedan pendientes de validación (sin pago).
      if (data.paymentMethod === 'addi' || data.paymentMethod === 'credit_validation') {
        return tx.invoice.update({ where: { id: inv.id }, data: { status: 'pending_validation' } });
      }
      if (data.paymentMethod) {
        const changeGiven = isCash && cashReceived !== null ? Math.max(0, cashReceived - total) : null;
        await tx.payment.create({
          data: {
            tenantId, invoiceId: inv.id,
            amount: total, // el total se cubre completo (efectivo ya validado >= total)
            method: data.paymentMethod,
            reference: data.paymentReference || null,
            cashReceived, changeGiven,
            paidAt: new Date(),
          },
        });
        return tx.invoice.update({ where: { id: inv.id }, data: { status: 'sent' } });
      }
      return inv;
    });

    this.subscriptionsService
      .trackUsage(tenantId, 'invoice_created', 1, { invoiceId: invoice.id })
      .catch(() => {});

    return invoice;
  }

  /** Cálculo central de totales con clamp de descuento, redondeo a peso y soporte de items custom. */
  private computeTotals(rawItems: any[], data: any) {
    type NormItem = { productId: string | null; description: string; quantity: number; unitPrice: number; discountValue: number; discountType: string; taxRate: number; lineTotal: number; isService?: boolean };
    const normItems: NormItem[] = [];
    let subtotal = 0, taxAmount = 0, discountAmount = 0, total = 0;

    // Tope realista por línea: $50.000 millones COP. Bloquea montos basura/overflow
    // (ej. 999.999.999.999) sin estorbar ventas legítimas de una PYME.
    const MAX_UNIT = 5e10;   // precio unitario máximo
    const MAX_LINE = 5e10;   // total de línea máximo
    for (const it of rawItems) {
      const qty = parseFloat(it.quantity) || 0;
      const unit = parseFloat(it.unitPrice) || 0;
      if (qty < 0 || unit < 0) throw new BadRequestException('Cantidad y precio no pueden ser negativos.');
      if (qty > 1e6 || unit > MAX_UNIT) throw new BadRequestException('Cantidad o precio fuera de rango permitido.');
      const gross = qty * unit;
      if (gross > MAX_LINE) throw new BadRequestException('El valor de una línea excede el máximo permitido.');
      const rawDiscType = it.discountType || 'percent';
      const discType = rawDiscType === 'amount' || rawDiscType === 'fixed' ? 'fixed' : 'percent';
      const discValRaw = parseFloat(it.discountValue) || 0;
      if (discValRaw < 0) throw new BadRequestException('El descuento no puede ser negativo.');
      // Clamp: el descuento nunca puede superar el bruto de la línea (evita IVA/total negativos).
      const lineDisc = Math.min(gross, discType === 'fixed' ? discValRaw : (gross * discValRaw) / 100);
      const taxRate = parseFloat(it.taxRate) || 0;
      const taxable = Math.max(0, gross - lineDisc);
      const lineTax = Math.round((taxable * taxRate) / 100);
      const lineTotal = Math.round(taxable + lineTax);

      subtotal += Math.round(gross);
      discountAmount += Math.round(lineDisc);
      taxAmount += lineTax;
      total += lineTotal;

      normItems.push({
        productId: it.productId || null,
        description: it.description || '',
        quantity: qty,
        unitPrice: unit,
        discountValue: discValRaw,
        discountType: discType,
        taxRate,
        lineTotal,
        isService: it.isService === true || it.type === 'service',
      });
    }

    // Propina y cargo por servicio: se suman al total, NO son base gravable de IVA.
    const tipAmount = Math.max(0, Math.round(parseFloat(data.tipAmount) || 0));
    const serviceCharge = Math.max(0, Math.round(parseFloat(data.serviceCharge) || 0));
    total += tipAmount + serviceCharge;

    return { normItems, subtotal, taxAmount, discountAmount, tipAmount, serviceCharge, total };
  }

  /**
   * Siguiente número de factura, atómico por tenant, dentro de una transacción Prisma.
   * Auto-sanador: si el Counter quedó por detrás de las facturas reales del tenant
   * (p. ej. facturas migradas/creadas antes de existir el Counter), salta el Counter
   * al máximo real + 1 para evitar colisiones de unique (tenantId, invoiceNumber).
   * Además reintenta si el candidato ya existe, hasta encontrar un número libre.
   */
  private async nextInvoiceNumber(tx: any, tenantId: string): Promise<string> {
    const fmt = (n: number) => `FE-${String(n).padStart(6, '0')}`;

    // Mayor número FE-###### realmente usado por este tenant.
    const last = await tx.invoice.findFirst({
      where: { tenantId, invoiceNumber: { startsWith: 'FE-' } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const realMax = last ? parseInt(String(last.invoiceNumber).replace(/\D/g, ''), 10) || 0 : 0;

    let counter = await tx.counter.upsert({
      where: { tenantId_name: { tenantId, name: 'invoice' } },
      create: { tenantId, name: 'invoice', value: realMax + 1 },
      update: { value: { increment: 1 } },
    });

    // Si el counter venía atrás del máximo real, sincronízalo hacia adelante.
    if (counter.value <= realMax) {
      counter = await tx.counter.update({
        where: { tenantId_name: { tenantId, name: 'invoice' } },
        data: { value: realMax + 1 },
      });
    }

    // Reintento defensivo por si aún existiera ese número (datos inconsistentes).
    let value = counter.value;
    for (let i = 0; i < 50; i++) {
      const exists = await tx.invoice.findFirst({
        where: { tenantId, invoiceNumber: fmt(value) },
        select: { id: true },
      });
      if (!exists) break;
      value += 1;
    }

    // Deja el counter en el valor efectivamente usado.
    if (value !== counter.value) {
      await tx.counter.update({
        where: { tenantId_name: { tenantId, name: 'invoice' } },
        data: { value },
      });
    }

    return fmt(value);
  }

  async updateInvoiceStatus(id: string, status: string, tenantId: string) {
    // Verificar que la factura pertenece al tenant
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    // Cancelación: revertir efectos operativos (transacción + inventario) de forma
    // atómica. Guarda contra doble cancelación: solo restaurar si NO estaba ya cancelada.
    const isCancelling = status === 'cancelled' && invoice.status !== 'cancelled';

    if (!isCancelling) {
      return this.prisma.invoice.update({
        where: { id },
        data: { status },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar la transacción de venta vinculada como cancelada (si existe).
      if (invoice.transactionId) {
        await tx.transaction.update({
          where: { id: invoice.transactionId },
          data: { status: 'cancelled' },
        });

        // 2. Reponer inventario por cada ítem físico (productId con fila de inventario)
        //    y registrar un movimiento compensatorio de tipo 'return' (cantidad positiva).
        //    Se reflejan exactamente los decrementos hechos en createInvoice.
        const items = await tx.transactionItem.findMany({
          where: { tenantId, transactionId: invoice.transactionId },
        });
        for (const it of items) {
          if (!it.productId) continue;
          const inv = await tx.inventory.findFirst({
            where: { tenantId, productId: it.productId },
          });
          if (!inv) continue; // sin fila de inventario -> servicio/no físico, nada que reponer
          const qty = BigInt(Math.round(it.quantity));
          if (qty <= 0n) continue;
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { increment: qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              inventoryId: inv.id,
              type: 'return',
              quantity: qty,
              reference: invoice.invoiceNumber,
              notes: `Cancelación factura ${invoice.invoiceNumber}`,
            },
          });
        }
      }

      // 3. Marcar la factura como cancelada.
      return tx.invoice.update({
        where: { id },
        data: { status },
      });
    });
  }

  async updateDianStatus(
    id: string,
    dianStatus: string,
    tenantId: string,
    dianCude?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        dianStatus,
        dianCude,
        dianSentAt: new Date(),
      },
    });
  }

  async getMonthlyStats(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, pending, thisMonth, monthRevenue] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.count({
        where: { tenantId, status: 'draft' },
      }),
      this.prisma.invoice.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, status: { not: 'cancelled' }, createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
    ]);

    return {
      totalRevenue: Math.round(total._sum.total ?? 0),
      revenueThisMonth: Math.round(monthRevenue._sum.total ?? 0),
      totalInvoices: total._count,
      pendingInvoices: pending,
      invoicesThisMonth: thisMonth,
    };
  }

  async sendWhatsapp(id: string, tenantId: string, body: any) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId }, include: { customer: true } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    const phone = body.phone || invoice.customer?.phone;
    if (!phone) throw new BadRequestException('El cliente no tiene número de WhatsApp');
    const clean = String(phone).replace(/\D/g, '');
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(invoice.total);
    const text = body.message || `Hola, te enviamos la factura ${invoice.invoiceNumber} por ${fmt}. Gracias por tu compra.`;
    const link = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    // Log in messages
    await this.prisma.message.create({
      data: {
        tenantId,
        channel: 'whatsapp',
        recipient: clean,
        recipientName: invoice.customer?.name,
        body: text,
        status: 'manual_opened',
        provider: 'wa.me',
        providerRef: invoice.id,
      },
    }).catch(() => null);
    return { ok: true, status: 'manual_opened', waUrl: link };
  }

  async logPrint(id: string, tenantId: string, body: any) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    // Frontend sends { type: 'receipt' | 'invoice', paperSize }. PrintLog only
    // has a `format` column, so map the print type onto it: PDF invoice -> 'pdf',
    // thermal receipt -> 'ticket'. Whitelist fields to avoid 500s on unknown cols.
    const type = body.type || body.format;
    const format = type === 'invoice' || type === 'pdf' ? 'pdf' : 'ticket';
    const paperSize = body.paperSize || (format === 'pdf' ? 'A4' : '80mm');
    const log = await this.prisma.printLog.create({
      data: {
        tenantId,
        entity: 'invoice',
        entityId: id,
        format,
        paperSize,
      },
    });
    // Return the read-DTO shape the frontend/list uses.
    return { id: log.id, type, paperSize: log.paperSize, createdAt: log.createdAt };
  }
}
