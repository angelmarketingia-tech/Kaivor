import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch, Delete, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomersService } from './customers.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';

@Controller('customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CustomersController {
  constructor(private customersService: CustomersService, private prisma: PrismaService) {}

  @Get()
  async getCustomers(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.customersService.getCustomers(req.user.tenantId, companyId, {
      search,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      offset: offset !== undefined ? parseInt(offset, 10) : undefined,
    });
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
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.customersService.deleteCustomer(id, req.user.tenantId);
  }

  // Customer Notes
  @Get(':id/notes')
  async getNotes(@Request() req: any, @Param('id') customerId: string) {
    // verify ownership
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId: req.user.tenantId } });
    if (!c) return [];
    const notes = await this.prisma.customerNote.findMany({
      where: { tenantId: req.user.tenantId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    // Consistent {body} shape; don't leak tenantId/customerId/authorId.
    return notes.map((n) => ({ id: n.id, body: n.content, authorName: n.authorName, createdAt: n.createdAt }));
  }

  @Post(':id/notes')
  async addNote(@Request() req: any, @Param('id') customerId: string, @Body() body: any) {
    return this.customersService.addNote(req.user.tenantId, customerId, body, req.user.userId, req.user.email);
  }
}
