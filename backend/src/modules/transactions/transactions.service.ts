import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getTransactions(tenantId: string, companyId?: string) {
    return this.prisma.transaction.findMany({
      where: { tenantId, ...(companyId && { companyId }) },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransaction(id: string, tenantId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!tx) throw new NotFoundException('Transacción no encontrada');
    return tx;
  }

  async createTransaction(tenantId: string, userId: string, data: any) {
    // Resolve default company if not provided
    let companyId = data.companyId;
    if (!companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId } });
      companyId = company?.id;
      if (!companyId) throw new NotFoundException('No hay empresa configurada para este tenant');
    }

    const { items, ...transactionData } = data;

    return this.prisma.$transaction(async (tx) => {
      // Create the sale
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          userId,
          companyId,
          customerId: transactionData.customerId || null,
          type: transactionData.type || 'sale',
          reference: transactionData.reference,
          total: parseFloat(transactionData.total) || 0,
          taxAmount: parseFloat(transactionData.taxAmount) || 0,
          discountAmount: parseFloat(transactionData.discountAmount) || 0,
          status: transactionData.status || 'completed',
          notes: transactionData.notes,
          items: {
            create: (items || []).map((it: any) => ({
              tenantId,
              productId: it.productId,
              quantity: parseFloat(it.quantity) || 1,
              unitPrice: parseFloat(it.unitPrice) || 0,
              discountPercent: parseFloat(it.discountPercent) || 0,
              taxPercent: parseFloat(it.taxPercent) || 0,
              lineTotal:
                parseFloat(it.lineTotal) ||
                ((parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0)),
            })),
          },
        },
        include: { items: true },
      });

      // Decrement stock for each item (POS effect on inventory)
      for (const it of items || []) {
        if (!it.productId) continue;
        const qty = parseInt(it.quantity) || 1;
        const inv = await tx.inventory.findFirst({
          where: { tenantId, productId: it.productId },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              inventoryId: inv.id,
              type: 'sale',
              quantity: BigInt(qty),
              reference: transaction.id,
            },
          });
        }
      }

      return transaction;
    });
  }

  async updateTransactionStatus(id: string, status: string, tenantId: string) {
    const tx = await this.prisma.transaction.findFirst({ where: { id, tenantId } });
    if (!tx) throw new NotFoundException('Transacción no encontrada');
    return this.prisma.transaction.update({
      where: { id },
      data: { status },
    });
  }
}
