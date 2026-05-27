import { Injectable, NotFoundException } from '@nestjs/common';
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
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    // Include inventory info
    const inventory = await this.prisma.inventory.findMany({ where: { tenantId, productId: id } });
    return {
      ...product,
      inventory: inventory.map((i) => ({
        warehouse: i.warehouse,
        quantity: Number(i.quantity),
        reorderPoint: Number(i.reorderPoint),
      })),
    };
  }

  async adjustStock(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const warehouse = data.warehouse || 'default';
    const quantity = BigInt(parseInt(data.quantity) || 0);
    const reorderPoint = data.reorderPoint !== undefined ? BigInt(parseInt(data.reorderPoint)) : undefined;
    const type = data.type || 'adjustment';
    const reference = data.reference || data.notes;

    // Upsert inventory
    const existing = await this.prisma.inventory.findFirst({ where: { tenantId, productId, warehouse } });
    let inventory;
    if (existing) {
      inventory = await this.prisma.inventory.update({
        where: { id: existing.id },
        data: {
          quantity: data.absolute ? quantity : { increment: quantity },
          ...(reorderPoint !== undefined && { reorderPoint }),
        },
      });
    } else {
      inventory = await this.prisma.inventory.create({
        data: {
          tenantId, productId, warehouse,
          quantity,
          ...(reorderPoint !== undefined && { reorderPoint }),
        },
      });
    }

    // Log movement
    await this.prisma.inventoryMovement.create({
      data: { tenantId, inventoryId: inventory.id, type, quantity, reference, notes: data.notes },
    });

    return {
      ok: true,
      inventory: {
        warehouse: inventory.warehouse,
        quantity: Number(inventory.quantity),
        reorderPoint: Number(inventory.reorderPoint),
      },
    };
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
