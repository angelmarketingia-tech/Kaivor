import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

    // 1b. Resolver companyId si no viene
    if (!data.companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId } });
      if (!company) throw new NotFoundException('No hay empresa configurada para este tenant');
      data.companyId = company.id;
    }

    // 1c. Auto-generar invoiceNumber si no viene
    if (!data.invoiceNumber) {
      const count = await this.prisma.invoice.count({ where: { tenantId } });
      data.invoiceNumber = `FE-${String(count + 1).padStart(6, '0')}`;
    }

    // 1d. Sanear: nunca permitir override del tenantId desde body
    delete data.tenantId;

    // 2. Crear factura asegurando tenantId del JWT
    const invoice = await this.prisma.invoice.create({
      data: {
        ...data,
        tenantId,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    // 3. Registrar evento de uso (sin bloquear si falla)
    this.subscriptionsService
      .trackUsage(tenantId, 'invoice_created', 1, { invoiceId: invoice.id })
      .catch(() => {/* uso no crítico */});

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
