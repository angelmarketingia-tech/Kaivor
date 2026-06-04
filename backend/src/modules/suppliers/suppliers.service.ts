import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const SUPPLIER_FIELDS = [
  'name', 'taxId', 'contactName', 'email', 'phone',
  'address', 'city', 'country', 'category', 'notes', 'status',
] as const;

function pickSupplier(data: any) {
  const out: any = {};
  for (const k of SUPPLIER_FIELDS) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, q?: string) {
    const where: any = { tenantId };
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { taxId: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { balances: { where: { status: 'pending' }, select: { amount: true } } },
    });
    return suppliers.map((s) => {
      const { balances, ...rest } = s as any;
      const outstandingBalance = (balances || []).reduce(
        (sum: number, b: any) => sum + (b.amount || 0), 0,
      );
      return { ...rest, outstandingBalance };
    });
  }

  async get(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: { balances: { orderBy: { createdAt: 'desc' } } },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    const { balances, ...rest } = supplier as any;
    const outstanding = (balances || [])
      .filter((b: any) => b.status === 'pending')
      .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    return { supplier: rest, outstanding, balances };
  }

  async create(tenantId: string, data: any) {
    let companyId = data.companyId;
    if (!companyId) {
      const c = await this.prisma.company.findFirst({ where: { tenantId } });
      companyId = c?.id;
    }
    const fields = pickSupplier(data);
    const name = typeof fields.name === 'string' ? fields.name.trim() : '';
    if (!name) throw new BadRequestException('El nombre del proveedor es requerido');
    return this.prisma.supplier.create({
      data: { ...fields, tenantId, companyId, name },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado');

    // Action: add a new pending balance
    if (data.action === 'add-balance') {
      const amount = Number(data.amount);
      await this.prisma.supplierBalance.create({
        data: {
          tenantId,
          supplierId: id,
          description: data.description || 'Saldo',
          amount: isNaN(amount) ? 0 : amount,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: 'pending',
        },
      });
      return this.get(tenantId, id);
    }

    // Action: mark a balance as paid/cancelled/pending
    if (data.action === 'mark-balance') {
      const balance = await this.prisma.supplierBalance.findFirst({
        where: { id: data.balanceId, tenantId, supplierId: id },
      });
      if (!balance) throw new NotFoundException('Saldo no encontrado');
      const status = data.status || 'paid';
      await this.prisma.supplierBalance.update({
        where: { id: balance.id },
        data: {
          status,
          paidAt: status === 'paid' ? new Date() : null,
        },
      });
      return this.get(tenantId, id);
    }

    // Normal supplier field update
    const fields = pickSupplier(data);
    return this.prisma.supplier.update({ where: { id }, data: fields });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado');
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }
}
