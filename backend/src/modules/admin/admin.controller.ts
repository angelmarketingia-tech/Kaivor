import { Controller, Get, UseGuards, ForbiddenException, Request } from '@nestjs/common';
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

  @Get('billing')
  billing(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.billing(); }

  @Get('errors')
  errors(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.errors(); }

  @Get('support')
  support(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.support(); }

  @Get('traffic')
  traffic(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.traffic(); }

  @Get('automations')
  automations(@Request() req: any) { this.assertSuperAdmin(req); return this.admin.automations(); }
}
