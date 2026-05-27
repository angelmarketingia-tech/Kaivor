import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch, Delete, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(AuthGuard('jwt'))
export class CustomersController {
  constructor(private customersService: CustomersService) {}

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
}
