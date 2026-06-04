import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getProducts(
    tenantId: string,
    opts?: { search?: string; category?: string; activeOnly?: boolean; limit?: number; offset?: number },
  ) {
    const search = opts?.search?.trim();
    const category = opts?.category?.trim();
    const take = opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 1000) : 200;
    const skip = opts?.offset && opts.offset > 0 ? opts.offset : undefined;

    return this.prisma.product.findMany({
      where: {
        tenantId,
        ...(opts?.activeOnly ? { isActive: true } : {}),
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        cost: true,
        category: true,
        type: true,
        unit: true,
        durationMin: true,
        imageUrl: true,
        color: true,
        isActive: true,
        barcode: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
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
        type: product.type,
        price: product.price,
        cost: product.cost,
        unit: product.unit,
        durationMin: product.durationMin,
        imageUrl: product.imageUrl,
        color: product.color,
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
    // Reference should be a document/system ref, not a copy of the free-text note.
    const reference = data.reference || `${type}:${warehouse}`;

    // Frontend sends:
    //  - newQuantity (absolute) + reorderPoint  → set inventory to exactly this
    //  - OR quantity (relative) + optional absolute flag
    const isAbsolute = data.newQuantity !== undefined || data.absolute === true;
    const rawQty = data.newQuantity !== undefined ? data.newQuantity : data.quantity;
    // Solo una cantidad realmente omitida es un no-op (0). Un string no numérico
    // ("", "abc", null) NUNCA debe colarse silenciosamente como 0.
    let targetQty: bigint;
    if (rawQty === undefined) {
      targetQty = 0n;
    } else {
      const parsed = parseInt(rawQty);
      if (Number.isNaN(parsed)) {
        throw new BadRequestException('La cantidad debe ser un número válido');
      }
      targetQty = BigInt(parsed);
    }
    const reorderPoint = data.reorderPoint !== undefined ? BigInt(parseInt(data.reorderPoint)) : undefined;

    const existing = await this.prisma.inventory.findFirst({ where: { tenantId, productId, warehouse } });
    let inventory;
    let movementQty: bigint;

    if (existing) {
      const before = existing.quantity;
      const after = isAbsolute ? targetQty : before + targetQty;
      // No permitir que el ajuste deje el stock en negativo (incluye objetivos
      // absolutos negativos) salvo que el negocio lo autorice explícitamente.
      if (after < 0n && data.allowNegative !== true) {
        throw new BadRequestException('El ajuste dejaría el stock en negativo');
      }
      movementQty = after - before;
      inventory = await this.prisma.inventory.update({
        where: { id: existing.id },
        data: {
          quantity: after,
          ...(reorderPoint !== undefined && { reorderPoint }),
        },
      });
    } else {
      // Sin fila previa, el resultado es el objetivo mismo (absoluto o relativo a 0).
      if (targetQty < 0n && data.allowNegative !== true) {
        throw new BadRequestException('El ajuste dejaría el stock en negativo');
      }
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
    // Validate required fields before touching Prisma (returns 400, not 500).
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('nombre es requerido');
    const sku = typeof data?.sku === 'string' ? data.sku.trim() : '';
    if (!sku) throw new BadRequestException('sku es requerido');

    let companyId = data.companyId;
    if (!companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
      companyId = company?.id;
    }
    // Whitelist ONLY columns that exist on Product. Real SME product forms also send
    // stock/taxRate/initialStock/reorderPoint, which live on OTHER models (Inventory) —
    // silently strip them here instead of letting Prisma throw a 500.
    const product = await this.prisma.product.create({
      data: {
        tenantId,
        companyId,
        sku,
        name,
        category: data.category ?? null,
        type: data.type === 'service' || data.type === 'package' ? data.type : 'product',
        price: data.price !== undefined ? parseFloat(data.price) : 0,
        cost: data.cost !== undefined && data.cost !== '' ? parseFloat(data.cost) : null,
        unit: data.unit ?? undefined,
        durationMin: data.durationMin !== undefined && data.durationMin !== '' ? parseInt(data.durationMin) : null,
        imageUrl: data.imageUrl ?? null,
        color: data.color ?? null,
        barcode: data.barcode ?? null,
        isActive: data.isActive ?? true,
      },
    });

    // If the caller sent initial stock, seed inventory through the proper path (best-effort).
    const initialStock = data.initialStock ?? data.stock;
    if (initialStock !== undefined && initialStock !== null && initialStock !== '') {
      try {
        await this.adjustStock(tenantId, product.id, {
          newQuantity: parseInt(initialStock),
          reorderPoint: data.reorderPoint,
          notes: 'Stock inicial al crear producto',
        });
      } catch {
        /* non-fatal — product exists; stock seeding is best-effort */
      }
    }
    return product;
  }

  async updateProduct(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    // Whitelist updatable Product columns (strip stock/taxRate/etc that belong elsewhere).
    const update: any = {};
    if (data.sku !== undefined) update.sku = data.sku;
    if (data.name !== undefined) update.name = data.name;
    if (data.category !== undefined) update.category = data.category;
    if (data.type !== undefined && ['product', 'service', 'package'].includes(data.type)) update.type = data.type;
    if (data.unit !== undefined) update.unit = data.unit;
    if (data.durationMin !== undefined) update.durationMin = data.durationMin === '' ? null : parseInt(data.durationMin);
    if (data.imageUrl !== undefined) update.imageUrl = data.imageUrl;
    if (data.color !== undefined) update.color = data.color;
    if (data.barcode !== undefined) update.barcode = data.barcode;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.price !== undefined) update.price = parseFloat(data.price);
    if (data.cost !== undefined && data.cost !== '') update.cost = parseFloat(data.cost);
    return this.prisma.product.update({ where: { id }, data: update });
  }

  async deleteProduct(id: string, tenantId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) return { ok: false };

    // Si el producto ya fue vendido (tiene ítems en transacciones), NO se borra físicamente
    // para no romper el histórico de facturas/ventas: se desactiva (soft-delete).
    const usedInSales = await this.prisma.transactionItem.count({ where: { tenantId, productId: id } });
    if (usedInSales > 0) {
      await this.prisma.product.update({ where: { id }, data: { isActive: false } });
      return { ok: true, softDeleted: true, reason: 'El producto tiene ventas registradas; se desactivó en vez de eliminarse para conservar el histórico.' };
    }

    // Sin ventas asociadas: borra inventario/movimientos (cascade) y el producto.
    await this.prisma.product.delete({ where: { id } });
    return { ok: true, softDeleted: false };
  }
}
