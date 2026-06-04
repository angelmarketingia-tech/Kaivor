import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ASSIGNABLE_ROLES, USER_LIMIT_BY_PLAN, ALL_PERMISSION_KEYS, effectivePermissions, isSuperRole, roleTemplatesForVertical } from '@/common/permissions';

// Columns that are SAFE to return to clients. NEVER include password, mfaSecretEnc,
// mfaBackupCodes, resetTokenHash, resetTokenExpiresAt.
const SAFE_USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  permissions: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AuthCtx = { tenantId: string; role: string };

// Sanitiza un objeto de overrides de permisos: solo claves válidas, solo booleanos.
function sanitizePermissions(input: any): Record<string, boolean> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Record<string, boolean> = {};
  for (const k of ALL_PERMISSION_KEYS) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Returns a single user, scoped to the caller's tenant. Never leaks secrets. */
  async getUserById(id: string, ctx: AuthCtx) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Lists users for a tenant. Caller may only list their OWN tenant unless they are a platform superadmin. */
  async getUsersByTenant(requestedTenantId: string, ctx: AuthCtx) {
    const isSuper = ctx.role === 'platform_superadmin' || ctx.role === 'superadmin';
    if (!isSuper && requestedTenantId !== ctx.tenantId) {
      throw new ForbiddenException('No puedes ver usuarios de otro tenant');
    }
    const users = await this.prisma.user.findMany({
      where: { tenantId: requestedTenantId },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    // Adjunta los permisos efectivos (defaults del rol + overrides) para la UI de equipo.
    return users.map((u) => ({
      ...u,
      effectivePermissions: effectivePermissions(u.role, (u.permissions as any) || null),
    }));
  }

  /** Plantillas de rol según el tipo de negocio del tenant (mejor UX). */
  async roleTemplates(tenantId: string) {
    const company = await this.prisma.company.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { businessType: true },
    });
    const vertical = company?.businessType || 'generic';
    const { vertical: verticalTemplates, generic } = roleTemplatesForVertical(vertical);
    return { vertical, templates: verticalTemplates, generic };
  }

  /** Uso de usuarios vs límite del plan del tenant. */
  async teamUsage(tenantId: string) {
    const [count, sub] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.subscription.findUnique({ where: { tenantId }, select: { plan: true } }),
    ]);
    const plan = sub?.plan || 'FREE';
    const limit = USER_LIMIT_BY_PLAN[plan] ?? 1;
    return { plan, used: count, limit, remaining: limit === -1 ? -1 : Math.max(0, limit - count) };
  }

  /** Creates a user inside the CALLER's tenant. Forces tenant, hashes password, restricts role. */
  async createUser(data: any, ctx: AuthCtx) {
    const isSuper = ctx.role === 'platform_superadmin' || ctx.role === 'superadmin';
    // Only admins (or platform superadmins) can create users.
    if (!isSuper && ctx.role !== 'admin' && ctx.role !== 'manager') {
      throw new ForbiddenException('No tienes permiso para crear usuarios');
    }

    const email = (data.email || '').trim().toLowerCase() || null;
    // username: minúsculas, sin espacios; solo letras/números/._-
    const username = (data.username || '').trim().toLowerCase().replace(/\s+/g, '') || null;
    if (!email && !username) throw new BadRequestException('Debes indicar un correo o un nombre de usuario');
    if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new BadRequestException('El usuario debe tener 3-30 caracteres (letras, números, . _ -)');
    }
    if (!data.password || String(data.password).length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    // Role allow-list. platform_superadmin can NEVER be assigned from the tenant API.
    let role = data.role;
    if (!isSuper) {
      if (role && !ASSIGNABLE_ROLES.includes(role)) {
        throw new BadRequestException('Rol no permitido');
      }
      role = role || 'cashier';
    } else {
      role = role || 'cashier';
    }

    // Tenant is ALWAYS the caller's tenant — never trust the body.
    const tenantId = ctx.tenantId;

    // Límite de usuarios por plan (FREE 1 · STARTER 3 · PRO_AI 6 · BUSINESS 15 · ENTERPRISE ∞).
    if (!isSuper) {
      const usage = await this.teamUsage(tenantId);
      if (usage.limit !== -1 && usage.used >= usage.limit) {
        throw new ForbiddenException(
          `Tu plan ${usage.plan} permite ${usage.limit} usuario(s). Mejora tu plan para agregar más miembros al equipo.`,
        );
      }
    }

    // Reject duplicate email/username within the tenant.
    if (email) {
      const dup = await this.prisma.user.findFirst({ where: { tenantId, email } });
      if (dup) throw new BadRequestException('El correo ya está registrado en este negocio');
    }
    if (username) {
      const dup = await this.prisma.user.findFirst({ where: { tenantId, username } });
      if (dup) throw new BadRequestException('Ese nombre de usuario ya existe en este negocio');
    }

    const hashedPassword = await bcrypt.hash(String(data.password), 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        username,
        name: data.name || null,
        password: hashedPassword,
        role,
        isActive: data.isActive ?? true,
        permissions: sanitizePermissions(data.permissions) ?? undefined,
      },
      select: SAFE_USER_SELECT,
    });
    return { ...user, effectivePermissions: effectivePermissions(user.role, (user.permissions as any) || null) };
  }

  /** Updates a user, scoped to the caller's tenant. Never updates secrets via raw body. */
  async updateUser(id: string, data: any, ctx: AuthCtx) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    const isSuper = isSuperRole(ctx.role);
    if (data.role !== undefined) {
      if (!isSuper && !ASSIGNABLE_ROLES.includes(data.role)) {
        throw new BadRequestException('Rol no permitido');
      }
      update.role = data.role;
    }
    // Permisos: el admin del negocio define overrides por usuario (interruptores).
    if (data.permissions !== undefined) {
      update.permissions = sanitizePermissions(data.permissions) ?? null;
    }
    if (data.password !== undefined) {
      if (String(data.password).length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
      update.password = await bcrypt.hash(String(data.password), 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: update,
      select: SAFE_USER_SELECT,
    });
    return { ...user, effectivePermissions: effectivePermissions(user.role, (user.permissions as any) || null) };
  }

  /** Elimina un usuario del tenant. No permite borrar el último admin ni a uno mismo. */
  async deleteUser(id: string, ctx: AuthCtx & { userId?: string }) {
    const target = await this.prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (ctx.userId && id === ctx.userId) throw new BadRequestException('No puedes eliminar tu propio usuario');
    if (target.role === 'admin') {
      const admins = await this.prisma.user.count({ where: { tenantId: ctx.tenantId, role: 'admin' } });
      if (admins <= 1) throw new BadRequestException('No puedes eliminar al único administrador del negocio');
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * El dueño/gerente resetea la contraseña de un miembro de SU equipo.
   * Genera una clave temporal legible (o usa la provista) y la devuelve UNA vez
   * para que el dueño se la entregue al empleado. Scoped al tenant.
   */
  async resetPassword(id: string, data: { newPassword?: string }, ctx: AuthCtx) {
    const target = await this.prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    const temp =
      data.newPassword && String(data.newPassword).length >= 8
        ? String(data.newPassword)
        : `Kaivor-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const hashed = await bcrypt.hash(temp, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed, resetTokenHash: null, resetTokenExpiresAt: null },
    });

    return { ok: true, name: target.name, email: target.email, username: target.username, temporaryPassword: temp };
  }
}
