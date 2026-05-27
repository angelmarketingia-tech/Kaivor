import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async getProducts(@Request() req: any) {
    return this.productsService.getProducts(req.user.tenantId);
  }

  @Get(':id')
  async getProduct(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProduct(id, req.user.tenantId);
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
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteProduct(id, req.user.tenantId);
  }

  @Post(':id/adjust-stock')
  async adjustStock(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.adjustStock(req.user.tenantId, id, body);
  }
}
