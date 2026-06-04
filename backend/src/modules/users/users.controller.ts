import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';
import { PERMISSIONS } from '@/common/permissions';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Catálogo de permisos disponibles (para construir los interruptores en la UI).
  @Get('permissions/catalog')
  catalog() {
    return { permissions: PERMISSIONS };
  }

  // Uso de usuarios vs límite del plan (para la UI de equipo).
  @Get('team/usage')
  usage(@Request() req: any) {
    return this.usersService.teamUsage(req.user.tenantId);
  }

  // Plantillas de rol según el tipo de negocio del tenant.
  @Get('team/role-templates')
  roleTemplates(@Request() req: any) {
    return this.usersService.roleTemplates(req.user.tenantId);
  }

  // Lista del equipo del tenant del usuario actual.
  @Get('team')
  team(@Request() req: any) {
    return this.usersService.getUsersByTenant(req.user.tenantId, { tenantId: req.user.tenantId, role: req.user.role });
  }

  @Get(':id')
  async getUser(@Request() req: any, @Param('id') id: string) {
    return this.usersService.getUserById(id, { tenantId: req.user.tenantId, role: req.user.role });
  }

  @Get('tenant/:tenantId')
  async getTenantUsers(@Request() req: any, @Param('tenantId') tenantId: string) {
    return this.usersService.getUsersByTenant(tenantId, { tenantId: req.user.tenantId, role: req.user.role });
  }

  @Post()
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async create(@Request() req: any, @Body() data: any) {
    return this.usersService.createUser(data, { tenantId: req.user.tenantId, role: req.user.role });
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data, { tenantId: req.user.tenantId, role: req.user.role });
  }

  @Delete(':id')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.usersService.deleteUser(id, { tenantId: req.user.tenantId, role: req.user.role, userId: req.user.userId });
  }

  // El dueño resetea la contraseña de un miembro de su equipo.
  @Post(':id/reset-password')
  @Roles('admin', 'manager', 'platform_superadmin', 'superadmin')
  async resetPassword(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.usersService.resetPassword(id, { newPassword: body?.newPassword }, { tenantId: req.user.tenantId, role: req.user.role });
  }
}
