import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getProducts(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProduct(id: string, tenantId: string) {
    return this.prisma.product.findFirst({
      where: { id, tenantId },
    });
  }

  async createProduct(tenantId: string, data: any) {
    let companyId = data.companyId;
    if (!companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
      companyId = company?.id;
    }
    const { companyId: _c, id: _id, tenantId: _t, createdAt: _ca, updatedAt: _ua, ...rest } = data;
    return this.prisma.product.create({
      data: {
        ...rest,
        price: rest.price !== undefined ? parseFloat(rest.price) : 0,
        cost: rest.cost !== undefined && rest.cost !== '' ? parseFloat(rest.cost) : null,
        tenantId,
        companyId,
      },
    });
  }

  async updateProduct(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    const { id: _id, tenantId: _t, companyId: _c, createdAt: _ca, updatedAt: _ua, ...rest } = data;
    if (rest.price !== undefined) rest.price = parseFloat(rest.price);
    if (rest.cost !== undefined && rest.cost !== '') rest.cost = parseFloat(rest.cost);
    return this.prisma.product.update({ where: { id }, data: rest });
  }

  async deleteProduct(id: string, tenantId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return { ok: false };
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
