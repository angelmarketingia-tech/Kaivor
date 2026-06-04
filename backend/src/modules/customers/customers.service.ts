import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async getCustomers(
    tenantId: string,
    companyId?: string,
    opts?: { search?: string; limit?: number; offset?: number },
  ) {
    const search = opts?.search?.trim();
    const take = opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 1000) : 200;
    const skip = opts?.offset && opts.offset > 0 ? opts.offset : undefined;
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { taxId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  /** Customer 360 envelope: {customer, stats, productsBought, invoices, messages, notes, nextAction} */
  async getCustomer(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Invoices for this customer (include payments to derive payment status)
    const invoicesRaw = await this.prisma.invoice.findMany({
      where: { tenantId, customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { payments: { select: { amount: true } } },
    });
    const invoices = invoicesRaw.map((inv: any) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const total = Number(inv.total) || 0;
      const paymentStatus = paid >= total && total > 0 ? 'paid' : 'pending';
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        total,
        status: inv.status,
        paymentStatus,
        createdAt: inv.createdAt,
      };
    });

    // Stats
    const totalBought = invoices.reduce((s, i) => s + i.total, 0);
    const invoiceCount = invoices.length;
    const avgTicket = invoiceCount ? totalBought / invoiceCount : 0;
    const lastPurchase = invoices.length ? invoices[0].createdAt : null;
    const daysSinceLastPurchase = lastPurchase
      ? Math.floor((Date.now() - new Date(lastPurchase).getTime()) / 86400000)
      : null;
    const overdue = invoices.filter((i) => i.paymentStatus !== 'paid');
    const overdueCount = overdue.length;
    const overdueAmount = overdue.reduce((s, i) => s + i.total, 0);

    let churnRisk = 'bajo';
    if (invoiceCount === 0) churnRisk = 'nuevo';
    else if (daysSinceLastPurchase !== null && daysSinceLastPurchase > 90) churnRisk = 'alto';
    else if (daysSinceLastPurchase !== null && daysSinceLastPurchase > 45) churnRisk = 'medio';

    const stats = {
      totalBought,
      invoiceCount,
      lastPurchase,
      daysSinceLastPurchase,
      churnRisk,
      overdueCount,
      overdueAmount,
      avgTicket,
    };

    // Products bought (aggregate from transaction items linked to this customer's transactions)
    let productsBought: { name: string; qty: number; total: number }[] = [];
    try {
      const txns = await this.prisma.transaction.findMany({
        where: { tenantId, customerId: id },
        select: { id: true },
      });
      const txnIds = txns.map((t) => t.id);
      if (txnIds.length) {
        const items = await this.prisma.transactionItem.findMany({
          where: { transactionId: { in: txnIds } },
          include: { product: { select: { name: true } } },
        });
        const agg = new Map<string, { name: string; qty: number; total: number }>();
        for (const it of items as any[]) {
          const name = it.product?.name || 'Producto';
          const cur = agg.get(name) || { name, qty: 0, total: 0 };
          cur.qty += Number(it.quantity) || 0;
          cur.total += Number(it.lineTotal) || 0;
          agg.set(name, cur);
        }
        productsBought = Array.from(agg.values()).sort((a, b) => b.total - a.total);
      }
    } catch {
      productsBought = [];
    }

    // Messages — Message model has no customerId, so match by the customer's phone/email recipient.
    // Phones are stored both raw ("+57 320 555 7788") and digits-only ("573205557788"),
    // so match against several normalized variants.
    let messages: any[] = [];
    try {
      const recipients: string[] = [];
      if (customer.email) recipients.push(customer.email);
      if (customer.phone) {
        const raw = customer.phone;
        const digits = raw.replace(/\D/g, '');
        recipients.push(raw, digits);
        if (!digits.startsWith('57')) recipients.push(`57${digits}`);
      }
      if (recipients.length) {
        const msgs = await this.prisma.message.findMany({
          where: { tenantId, recipient: { in: Array.from(new Set(recipients)) } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        messages = msgs.map((m: any) => ({
          id: m.id,
          channel: m.channel,
          destination: m.recipient ?? '',
          message: m.body ?? '',
          status: m.status,
          sentAt: m.createdAt,
        }));
      }
    } catch {
      messages = [];
    }

    // Notes (frontend reads {body, authorName, createdAt})
    const notesRaw = await this.prisma.customerNote.findMany({
      where: { tenantId, customerId: id },
      orderBy: { createdAt: 'desc' },
    });
    const notes = notesRaw.map((n) => ({
      id: n.id,
      body: n.content,
      authorName: n.authorName,
      createdAt: n.createdAt,
    }));

    // AI next action (simple heuristic)
    let nextAction = 'Mantén el contacto y ofrece tus productos más vendidos.';
    if (churnRisk === 'alto') nextAction = `Hace ${daysSinceLastPurchase} días que no compra. Envíale una promoción para reactivarlo.`;
    else if (churnRisk === 'nuevo') nextAction = 'Cliente nuevo: agradécele su primera visita y registra sus datos de contacto.';
    else if (overdueCount > 0) nextAction = `Tiene ${overdueCount} factura(s) pendiente(s). Envíale un recordatorio de pago amable.`;
    else if (customer.vip) nextAction = 'Cliente VIP: ofrécele atención preferencial o un beneficio exclusivo.';

    return { customer, stats, productsBought, invoices, messages, notes, nextAction };
  }

  async createCustomer(tenantId: string, data: any) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('El nombre del cliente es requerido');
    if (!data.companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
      if (company) data.companyId = company.id;
    }
    // Whitelist valid Customer columns
    return this.prisma.customer.create({
      data: {
        tenantId,
        companyId: data.companyId,
        name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        taxId: data.taxId ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        vip: data.vip ?? false,
        status: data.status ?? 'active',
      },
    });
  }

  async updateCustomer(id: string, data: any, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    // Whitelist updatable columns (prevents 500 from unknown fields).
    const update: any = {};
    for (const k of ['name', 'email', 'phone', 'taxId', 'address', 'city', 'vip', 'status']) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    return this.prisma.customer.update({ where: { id }, data: update });
  }

  async deleteCustomer(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.customer.delete({ where: { id } });
  }

  /** Add a note. Frontend sends {body} and reads {body}. */
  async addNote(tenantId: string, customerId: string, data: any, authorId?: string, authorName?: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    const content = data.body ?? data.content;
    if (!content || !String(content).trim()) throw new BadRequestException('La nota no puede estar vacía');
    const note = await this.prisma.customerNote.create({
      data: { tenantId, customerId, authorId: authorId ?? null, authorName: authorName ?? null, content: String(content) },
    });
    return { id: note.id, body: note.content, authorName: note.authorName, createdAt: note.createdAt };
  }
}
