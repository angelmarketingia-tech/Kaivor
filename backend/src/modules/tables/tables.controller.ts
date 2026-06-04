import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TablesService } from './tables.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';

@Controller('tables')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TablesController {
  constructor(private tables: TablesService) {}

  @Get()
  list(@Request() req: any) {
    return this.tables.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.tables.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.tables.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.tables.delete(req.user.tenantId, id);
  }

  @Post(':id/order')
  openOrder(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.tables.openOrder(req.user.tenantId, id, body);
  }

  @Patch(':id/order')
  updateOrder(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.tables.updateOrder(req.user.tenantId, id, body);
  }

  @Post(':id/close')
  close(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.tables.close(req.user.tenantId, id, body, req.user.userId);
  }
}
