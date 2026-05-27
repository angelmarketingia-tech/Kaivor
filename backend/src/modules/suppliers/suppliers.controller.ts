import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersController {
  constructor(private suppliers: SuppliersService) {}

  @Get()
  list(@Request() req: any, @Query('q') q?: string) {
    return this.suppliers.list(req.user.tenantId, q);
  }

  @Get(':id')
  get(@Request() req: any, @Param('id') id: string) {
    return this.suppliers.get(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.suppliers.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.suppliers.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.suppliers.delete(req.user.tenantId, id);
  }
}
