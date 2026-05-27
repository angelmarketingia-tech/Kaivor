import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string, q?: string) {
    const where: any = { tenantId };
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { taxId: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    return this.prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async get(tenantId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return s;
  }

  async create(tenantId: string, data: any) {
    let companyId = data.companyId;
    if (!companyId) {
      const c = await this.prisma.company.findFirst({ where: { tenantId } });
      companyId = c?.id;
    }
    const { id: _i, tenantId: _t, ...rest } = data;
    return this.prisma.supplier.create({
      data: { ...rest, tenantId, companyId, name: rest.name || 'Sin nombre' },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado');
    const { id: _i, tenantId: _t, companyId: _c, createdAt: _ca, updatedAt: _ua, ...rest } = data;
    return this.prisma.supplier.update({ where: { id }, data: rest });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado');
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }
}
