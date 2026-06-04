import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';
import { hasPermission } from '@/common/permissions';

// Oculta el costo (y por tanto la utilidad) si el usuario no tiene el permiso costs.view.
function maskCost(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskCost);
  const { cost, ...rest } = obj;
  return rest;
}
function canSeeCost(req: any): boolean {
  return hasPermission(req.user?.role, req.user?.permissions, 'costs.view' as any);
}

@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async getProducts(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.productsService.getProducts(req.user.tenantId, {
      search,
      category,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      offset: offset !== undefined ? parseInt(offset, 10) : undefined,
    });
    if (canSeeCost(req)) return result;
    // Enmascara cost en cualquier shape ({data:[...]}, [...], etc.)
    const r: any = result;
    if (Array.isArray(r)) return maskCost(r);
    if (r && Array.isArray(r.data)) return { ...r, data: maskCost(r.data) };
    return r;
  }

  @Get(':id')
  async getProduct(@Request() req: any, @Param('id') id: string) {
    const result = await this.productsService.getProduct(id, req.user.tenantId);
    if (canSeeCost(req)) return result;
    // El detalle tiene forma {product, stats, inventory}; el costo vive en product.cost,
    // así que hay que enmascarar el objeto anidado (no solo el nivel superior).
    const r: any = result;
    if (r && r.product) return { ...r, product: maskCost(r.product) };
    return maskCost(r);
  }

  @Post()
  async create(@Request() req: any, @Body() data: any) {
    return this.productsService.createProduct(req.user.tenantId, data);
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.productsService.updateProduct(id, req.user.tenantId, data);
  }

  @Delete(':id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteProduct(id, req.user.tenantId);
  }

  @Post(':id/adjust-stock')
  async adjustStock(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.adjustStock(req.user.tenantId, id, body);
  }
}
