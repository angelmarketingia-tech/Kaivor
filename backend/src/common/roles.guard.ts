import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role-based access guard. Reads the required roles set by @Roles() and checks
 * them against req.user.role (populated by the JWT strategy).
 *
 * Must run AFTER AuthGuard('jwt') so req.user is available. If no roles are
 * declared on the handler/controller, access is allowed (fail-open only for
 * unannotated routes — annotated routes are fail-closed).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() declared — this guard doesn't restrict the route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;

    if (!role) {
      throw new ForbiddenException('No autorizado: rol no presente');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('Acción restringida: rol insuficiente');
    }

    return true;
  }
}
