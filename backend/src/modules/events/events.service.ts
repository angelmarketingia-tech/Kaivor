import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    // Synthesize a recent-activity feed from real data
    const [invoices, transactions, customers] = await Promise.all([
      this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, invoiceNumber: true, total: true, createdAt: true, status: true } }),
      this.prisma.transaction.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, total: true, type: true, createdAt: true } }),
      this.prisma.customer.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, createdAt: true } }),
    ]);
    const events: any[] = [];
    invoices.forEach((i) => events.push({ type: 'invoice', title: `Factura ${i.invoiceNumber}`, amount: i.total, status: i.status, at: i.createdAt }));
    transactions.forEach((t) => events.push({ type: 'sale', title: `Venta ${t.type}`, amount: t.total, at: t.createdAt }));
    customers.forEach((c) => events.push({ type: 'customer', title: `Cliente: ${c.name}`, at: c.createdAt }));
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { events: events.slice(0, 20) };
  }
}
