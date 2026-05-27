import { prisma } from './db';
import type { JwtPayload } from './auth';

export const PLATFORM_ROLES = [
  'platform_superadmin', 'platform_admin', 'platform_support', 'platform_billing', 'platform_ops',
];

// Verifies the JWT belongs to a Kaivor staff user with one of the allowed platform roles.
// Returns the staff user, or null if not authorized.
export async function requirePlatform(jwt: JwtPayload | null, allowed: string[] = PLATFORM_ROLES) {
  if (!jwt) return null;
  const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
  if (!user || !user.platformRole || !allowed.includes(user.platformRole)) return null;
  return user;
}

export function adminForbidden() {
  return Response.json({ message: 'Acceso restringido al equipo de Kaivor.' }, { status: 403 });
}

// Best-effort event recorder — never throws.
export async function recordEvent(eventName: string, opts: {
  tenantId?: string | null; userId?: string | null; path?: string | null; metadata?: any;
} = {}) {
  try {
    await prisma.appEvent.create({
      data: {
        eventName,
        tenantId: opts.tenantId ?? null,
        userId: opts.userId ?? null,
        path: opts.path ?? null,
        metadata: opts.metadata ?? undefined,
      },
    });
  } catch { /* analytics must never break a request */ }
}
