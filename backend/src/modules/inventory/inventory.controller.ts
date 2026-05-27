import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private prisma: PrismaService,
  ) {}

  @Get()
  getInventory(@Request() req: any, @Query('warehouse') warehouse?: string) {
    return this.inventoryService.getInventory(req.user.tenantId, warehouse);
  }

  @Get('alerts')
  getAlerts(@Request() req: any) {
    return this.inventoryService.getAlerts(req.user.tenantId);
  }

  @Post('ask')
  async ask(@Request() req: any, @Body('question') question: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId: req.user.tenantId },
      select: { plan: true },
    });
    return this.inventoryService.ask(req.user.tenantId, question, sub?.plan || 'FREE');
  }

  @Get('product')
  getInventoryForProduct(@Request() req: any, @Query('productId') productId: string) {
    return this.inventoryService.getInventoryForProduct(productId, req.user.tenantId);
  }
}
