import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isSuperRole } from './permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/** @RequirePermissions('costs.view', ...) — user must hold ALL listed permissions. */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

/**
 * Checks req.user.permissions (populated by JwtStrategy.validate) against the
 * @RequirePermissions() on the handler/controller. Must run after AuthGuard('jwt').
 * Unannotated routes are not restricted. admin/manager/superadmin bypass.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;
    if (isSuperRole(role) || role === 'admin' || role === 'manager') return true;

    const perms = req?.user?.permissions || {};
    const missing = required.filter((p) => perms[p] !== true);
    if (missing.length) {
      throw new ForbiddenException(`Acceso restringido: falta el permiso ${missing.join(', ')}`);
    }
    return true;
  }
}
