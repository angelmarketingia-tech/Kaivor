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

    // Inventory rows (one per warehouse) + their movements
    const inventoryRows = await this.prisma.inventory.findMany({
      where: { tenantId, productId: id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    let totalStock = 0;
    let reorderPoint = 0;
    const inventory = inventoryRows.map((inv) => {
      const qty = Number(inv.quantity);
      const rp = Number(inv.reorderPoint);
      totalStock += qty;
      reorderPoint = Math.max(reorderPoint, rp);
      return {
        id: inv.id,
        warehouse: inv.warehouse,
        quantity: qty,
        reorderPoint: rp,
        movements: inv.movements.map((m) => ({
          id: m.id,
          type: m.type,
          quantity: Number(m.quantity),
          reference: m.reference,
          notes: m.notes,
          createdAt: m.createdAt,
        })),
      };
    });

    // Sales analytics from TransactionItem
    const salesAgg = await this.prisma.transactionItem.aggregate({
      where: { tenantId, productId: id },
      _sum: { quantity: true, lineTotal: true },
      _count: true,
    });

    // Stock status
    const stockStatus =
      totalStock <= 0 ? 'out' :
      totalStock <= reorderPoint ? 'low' :
      'in_stock';

    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
        cost: product.cost,
        unit: product.unit,
        barcode: product.barcode,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      stats: {
        totalStock,
        reorderPoint,
        stockStatus,
        totalSold: Number(salesAgg._sum.quantity || 0),
        totalRevenue: Number(salesAgg._sum.lineTotal || 0),
        timesInvoiced: salesAgg._count,
      },
      inventory,
    };
  }

  async adjustStock(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const warehouse = data.warehouse || 'default';
    const type = data.type || 'adjustment';
    const notes = data.notes;
    const reference = data.reference || notes;

    // Frontend sends:
    //  - newQuantity (absolute) + reorderPoint  → set inventory to exactly this
    //  - OR quantity (relative) + optional absolute flag
    const isAbsolute = data.newQuantity !== undefined || data.absolute === true;
    const rawQty = data.newQuantity !== undefined ? data.newQuantity : data.quantity;
    const targetQty = BigInt(parseInt(rawQty) || 0);
    const reorderPoint = data.reorderPoint !== undefined ? BigInt(parseInt(data.reorderPoint)) : undefined;

    const existing = await this.prisma.inventory.findFirst({ where: { tenantId, productId, warehouse } });
    let inventory;
    let movementQty: bigint;

    if (existing) {
      const before = existing.quantity;
      const after = isAbsolute ? targetQty : before + targetQty;
      movementQty = after - before;
      inventory = await this.prisma.inventory.update({
        where: { id: existing.id },
        data: {
          quantity: after,
          ...(reorderPoint !== undefined && { reorderPoint }),
        },
      });
    } else {
      inventory = await this.prisma.inventory.create({
        data: {
          tenantId, productId, warehouse,
          quantity: targetQty,
          ...(reorderPoint !== undefined && { reorderPoint }),
        },
      });
      movementQty = targetQty;
    }

    await this.prisma.inventoryMovement.create({
      data: { tenantId, inventoryId: inventory.id, type, quantity: movementQty, reference, notes },
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
