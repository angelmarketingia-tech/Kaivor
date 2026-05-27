import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch, Delete, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomersService } from './customers.service';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('customers')
@UseGuards(AuthGuard('jwt'))
export class CustomersController {
  constructor(private customersService: CustomersService, private prisma: PrismaService) {}

  @Get()
  async getCustomers(
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.customersService.getCustomers(req.user.tenantId, companyId);
  }

  @Get(':id')
  async getCustomer(@Request() req: any, @Param('id') id: string) {
    return this.customersService.getCustomer(id, req.user.tenantId);
  }

  @Post()
  async create(@Request() req: any, @Body() data: any) {
    return this.customersService.createCustomer(req.user.tenantId, data);
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.customersService.updateCustomer(id, data, req.user.tenantId);
  }

  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.customersService.deleteCustomer(id, req.user.tenantId);
  }

  // Customer Notes
  @Get(':id/notes')
  async getNotes(@Request() req: any, @Param('id') customerId: string) {
    // verify ownership
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId: req.user.tenantId } });
    if (!c) return { notes: [] };
    return this.prisma.customerNote.findMany({
      where: { tenantId: req.user.tenantId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/notes')
  async addNote(@Request() req: any, @Param('id') customerId: string, @Body() body: any) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId: req.user.tenantId } });
    if (!c) return { error: 'Cliente no encontrado' };
    return this.prisma.customerNote.create({
      data: {
        tenantId: req.user.tenantId,
        customerId,
        authorId: req.user.userId,
        authorName: req.user.email,
        content: body.content,
      },
    });
  }
}
