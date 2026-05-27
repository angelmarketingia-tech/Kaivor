import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async getInvoices(tenantId: string, companyId?: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  async getInvoice(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { payments: true, customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return invoice;
  }

  async createInvoice(data: any, tenantId: string) {
    // 1. Verificar límite del plan antes de crear
    await this.subscriptionsService.checkInvoiceLimit(tenantId);

    // 2. Resolver companyId si no viene
    let companyId = data.companyId;
    if (!companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId } });
      if (!company) throw new NotFoundException('No hay empresa configurada para este tenant');
      companyId = company.id;
    }

    if (!data.customerId) {
      throw new BadRequestException('customerId es requerido');
    }

    // 3. Calcular totales a partir de items (si vienen)
    const rawItems = Array.isArray(data.items) ? data.items : [];
    let subtotal = parseFloat(data.subtotal) || 0;
    let taxAmount = parseFloat(data.taxAmount) || 0;
    let discountAmount = parseFloat(data.discountAmount) || 0;
    let total = parseFloat(data.total) || 0;

    type NormItem = { productId: string | null; description: string; quantity: number; unitPrice: number; discountValue: number; taxRate: number; lineTotal: number };
    const normItems: NormItem[] = [];

    if (rawItems.length) {
      subtotal = 0; taxAmount = 0; discountAmount = 0; total = 0;
      for (const it of rawItems) {
        const qty = parseFloat(it.quantity) || 0;
        const unit = parseFloat(it.unitPrice) || 0;
        const gross = qty * unit;
        const discType = it.discountType || 'percent';
        const discVal = parseFloat(it.discountValue) || 0;
        const lineDisc = discType === 'amount' ? discVal : (gross * discVal) / 100;
        const taxRate = parseFloat(it.taxRate) || 0;
        const taxable = gross - lineDisc;
        const lineTax = (taxable * taxRate) / 100;
        const lineTotal = taxable + lineTax;

        subtotal += gross;
        discountAmount += lineDisc;
        taxAmount += lineTax;
        total += lineTotal;

        normItems.push({
          productId: it.productId || null,
          description: it.description || '',
          quantity: qty,
          unitPrice: unit,
          discountValue: discVal,
          taxRate,
          lineTotal,
        });
      }
    }

    if (total <= 0) {
      throw new BadRequestException('La factura debe tener al menos un item con monto mayor a 0');
    }

    // 4. Auto-generar invoiceNumber
    const invoiceNumber = data.invoiceNumber || `FE-${String((await this.prisma.invoice.count({ where: { tenantId } })) + 1).padStart(6, '0')}`;

    // 5. Crear factura + transaction + items + payment de forma atómica
    const invoice = await this.prisma.$transaction(async (tx) => {
      // 5a. Crear transaction (la venta operativa)
      let transactionId: string | null = null;
      if (normItems.length) {
        const transaction = await tx.transaction.create({
          data: {
            tenantId,
            companyId,
            customerId: data.customerId,
            userId: data.userId || null,
            type: 'sale',
            total,
            taxAmount,
            discountAmount,
            status: 'completed',
            items: {
              create: normItems.filter((i) => i.productId).map((i) => ({
                tenantId,
                productId: i.productId as string,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                discountPercent: i.discountValue,
                taxPercent: i.taxRate,
                lineTotal: i.lineTotal,
              })),
            },
          },
        });
        transactionId = transaction.id;

        // 5b. Decrementar inventario por cada item con productId
        for (const it of normItems) {
          if (!it.productId) continue;
          const inv = await tx.inventory.findFirst({
            where: { tenantId, productId: it.productId },
          });
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: { decrement: BigInt(Math.round(it.quantity)) } },
            });
            await tx.inventoryMovement.create({
              data: {
                tenantId,
                inventoryId: inv.id,
                type: 'sale',
                quantity: BigInt(-Math.round(it.quantity)),
                reference: invoiceNumber,
              },
            });
          }
        }
      }

      // 5c. Crear factura
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          companyId,
          customerId: data.customerId,
          userId: data.userId || null,
          transactionId,
          invoiceNumber,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: data.status || 'draft',
          subtotal,
          taxAmount,
          discountAmount,
          total,
          notes: data.notes || null,
        },
      });

      // 5d. Registrar payment si vino método de pago
      if (data.paymentMethod) {
        await tx.payment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: total,
            method: data.paymentMethod,
            reference: data.paymentReference || null,
            paidAt: new Date(),
          },
        });
        // marcar factura como pagada si el monto cubre
        await tx.invoice.update({ where: { id: inv.id }, data: { status: 'sent' } });
      }

      return inv;
    });

    // 6. Registrar evento de uso (sin bloquear si falla)
    this.subscriptionsService
      .trackUsage(tenantId, 'invoice_created', 1, { invoiceId: invoice.id })
      .catch(() => {});

    return invoice;
  }

  async updateInvoiceStatus(id: string, status: string, tenantId: string) {
    // Verificar que la factura pertenece al tenant
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status },
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

    const [total, pending, thisMonth] = await Promise.all([
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
    ]);

    return {
      totalRevenue: total._sum.total ?? 0,
      totalInvoices: total._count,
      pendingInvoices: pending,
      invoicesThisMonth: thisMonth,
    };
  }

  async sendWhatsapp(id: string, tenantId: string, body: any) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId }, include: { customer: true } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    const phone = body.phone || invoice.customer?.phone;
    if (!phone) return { ok: false, error: 'No hay número de WhatsApp del cliente' };
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
    return { ok: true, status: 'manual_opened', fallbackLink: link };
  }

  async logPrint(id: string, tenantId: string, body: any) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return this.prisma.printLog.create({
      data: {
        tenantId,
        entity: 'invoice',
        entityId: id,
        format: body.format || 'pdf',
      },
    });
  }
}
