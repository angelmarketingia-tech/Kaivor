import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantsService } from './tenants.service';
import { RolesGuard } from '@/common/roles.guard';
import { Roles } from '@/common/roles.decorator';

@Controller('tenants')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // Crear tenant — restringido a superadmin platform-level
  @Post()
  @Roles('platform_superadmin', 'superadmin')
  async create(@Request() req: any, @Body() data: { slug: string; name: string }) {
    if (req.user.role !== 'platform_superadmin' && req.user.role !== 'superadmin') {
      throw new ForbiddenException('Acción restringida a superadmin de plataforma');
    }
    return this.tenantsService.createTenant(data);
  }

  // Obtener tenant: solo el propio (o superadmin)
  @Get(':id')
  async get(@Request() req: any, @Param('id') id: string) {
    if (req.user.tenantId !== id && req.user.role !== 'platform_superadmin' && req.user.role !== 'superadmin') {
      throw new ForbiddenException('No tienes acceso a este tenant');
    }
    return this.tenantsService.getTenant(id);
  }

  @Get('slug/:slug')
  async getBySlug(@Request() req: any, @Param('slug') slug: string) {
    const tenant = await this.tenantsService.getTenantBySlug(slug);
    if (!tenant) return null;
    if (req.user.tenantId !== tenant.id && req.user.role !== 'platform_superadmin' && req.user.role !== 'superadmin') {
      throw new ForbiddenException('No tienes acceso a este tenant');
    }
    return tenant;
  }
}
