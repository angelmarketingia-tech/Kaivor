import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HrService } from './hr.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';
import { PermissionsGuard, RequirePermissions } from '@/common/permissions.guard';

@Controller('hr')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@RequirePermissions('hr.view')
export class HrController {
  constructor(private hr: HrService, private prisma: PrismaService) {}

  @Get('summary')
  summary(@Request() req: any) {
    return this.hr.summary(req.user.tenantId);
  }

  @Get('employees')
  listEmployees(@Request() req: any) {
    return this.hr.listEmployees(req.user.tenantId);
  }

  @Post('employees')
  createEmployee(@Request() req: any, @Body() body: any) {
    return this.hr.createEmployee(req.user.tenantId, body);
  }

  @Get('employees/:id')
  async getEmployee(@Request() req: any, @Param('id') id: string) {
    const r = await this.hr.getEmployee(req.user.tenantId, id);
    if (!r) throw new NotFoundException('Empleado no encontrado');
    return r;
  }

  @Patch('employees/:id')
  async updateEmployee(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const r = await this.hr.updateEmployee(req.user.tenantId, id, body);
    if (!r) throw new NotFoundException('Empleado no encontrado');
    return r;
  }

  @Delete('employees/:id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  deleteEmployee(@Request() req: any, @Param('id') id: string) {
    return this.hr.deleteEmployee(req.user.tenantId, id);
  }

  @Get('payroll')
  listPayroll(@Request() req: any) {
    return this.hr.listPayroll(req.user.tenantId);
  }

  @Post('payroll')
  createPayroll(@Request() req: any, @Body() body: any) {
    return this.hr.createPayroll(req.user.tenantId, body);
  }

  @Get('payroll/:id')
  async getPayrollPeriod(@Request() req: any, @Param('id') id: string) {
    const r = await this.hr.getPayrollPeriod(req.user.tenantId, id);
    if (!r) throw new NotFoundException('Periodo no encontrado');
    return r;
  }

  @Patch('payroll/:id')
  updatePayrollPeriod(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.hr.updatePayrollPeriod(req.user.tenantId, id, body);
  }

  @Get('payroll/:id/receipts')
  listReceipts(@Request() req: any, @Param('id') id: string) {
    return this.hr.listPayrollReceipts(req.user.tenantId, id);
  }

  @Post('payroll/:id/receipts')
  createReceipt(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.hr.createPayrollReceipt(req.user.tenantId, id, body);
  }

  @Get('balances')
  listBalances(@Request() req: any) {
    return this.hr.listBalances(req.user.tenantId);
  }

  @Post('balances')
  createBalance(@Request() req: any, @Body() body: any) {
    return this.hr.createBalance(req.user.tenantId, body);
  }

  @Patch('balances')
  updateBalance(@Request() req: any, @Body() body: any) {
    return this.hr.updateBalance(req.user.tenantId, body);
  }

  @Get('vacancies')
  listVacancies(@Request() req: any) {
    return this.hr.listVacancies(req.user.tenantId);
  }

  @Post('vacancies')
  createVacancy(@Request() req: any, @Body() body: any) {
    return this.hr.createVacancy(req.user.tenantId, body);
  }

  @Get('vacancies/:id')
  getVacancy(@Request() req: any, @Param('id') id: string) {
    return this.hr.getVacancy(req.user.tenantId, id);
  }

  @Patch('vacancies/:id')
  updateVacancy(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.hr.updateVacancy(req.user.tenantId, id, body);
  }

  @Post('candidates')
  createCandidate(@Request() req: any, @Body() body: any) {
    return this.hr.createCandidate(req.user.tenantId, body);
  }

  @Post('ai')
  async ai(@Request() req: any, @Body('question') question: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: req.user.tenantId }, select: { plan: true } });
    return this.hr.ask(req.user.tenantId, question, sub?.plan || 'FREE');
  }
}
