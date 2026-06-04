import { Controller, Get, Post, Patch, Body, UseGuards, ForbiddenException, BadRequestException, Request, Param, Query, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private admin: AdminService) {}

  // Cualquier handler aquí es solo para platform_superadmin
  private assertSuperAdmin(req: any) {
    const role = req.user?.role;
    if (role !== 'platform_superadmin' && role !== 'superadmin') {
      throw new ForbiddenException('Acceso restringido al superadmin de plataforma');
    }
  }

  @Get('dashboard')
  dashboard(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.dashboard(); }

  @Get('customers')
  customers(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.customers(); }

  @Get('customers/:id')
  async customerDetail(@Request() req: any, @Param('id') id: string) {
    this.assertSuperAdmin(req);
    const r = await this.admin.customerDetail(id);
    if (!r) throw new NotFoundException('Tenant no encontrado');
    return r;
  }

  // Cambiar plan / suspender / reactivar un negocio desde la Consola.
  @Patch('customers/:id')
  async updateCustomer(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertSuperAdmin(req);
    return this.admin.updateCustomer(id, { action: body?.action, plan: body?.plan });
  }

  @Get('billing')
  billing(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.billing(); }

  @Get('errors')
  errors(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.errors(); }

  @Get('support')
  support(@Request() req: any, @Query('status') status?: string) {
    this.assertSuperAdmin(req);
    return this.admin.support(status);
  }

  @Patch('support')
  updateSupport(@Request() req: any, @Body() body: any) {
    this.assertSuperAdmin(req);
    const id = body?.id || body?.ticketId;
    if (!id) throw new BadRequestException('id del ticket requerido');
    return this.admin.updateSupportTicket(id, { status: body?.status, response: body?.response });
  }

  @Get('traffic')
  traffic(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.traffic(); }

  @Get('automations')
  automations(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.automations(); }

  // Resetear la contraseña de cualquier usuario (soporte a negocios que olvidaron su clave).
  @Post('reset-user-password')
  resetUserPassword(@Request() req: any, @Body() body: any) {
    this.assertSuperAdmin(req);
    if (!body?.userId && !body?.email) throw new BadRequestException('userId o email requerido');
    return this.admin.resetUserPassword({ userId: body?.userId, email: body?.email, newPassword: body?.newPassword });
  }
}
