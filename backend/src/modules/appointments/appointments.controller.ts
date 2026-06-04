import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentsService } from './appointments.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';

@Controller('appointments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppointmentsController {
  constructor(private appointments: AppointmentsService) {}

  @Get()
  list(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professional') professional?: string,
  ) {
    return this.appointments.list(req.user.tenantId, from, to, professional);
  }

  @Get('day')
  day(@Request() req: any, @Query('date') date?: string) {
    return this.appointments.day(req.user.tenantId, date);
  }

  @Get('availability')
  availability(
    @Request() req: any,
    @Query('professional') professional?: string,
    @Query('date') date?: string,
  ) {
    return this.appointments.availability(req.user.tenantId, professional, date);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.appointments.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.appointments.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.appointments.delete(req.user.tenantId, id);
  }
}
