import { prisma } from './db';
import type { JwtPayload } from './auth';

// Central account-scoping service.
// The frontend sends the active account via the `x-account-id` header.
// 'all' / empty  → consolidated (no filter, sees everything in the tenant).
// a valid id     → scoped to that child account.
// The header is NEVER trusted blindly: the account must belong to the tenant.

export async function getActiveAccountId(jwt: JwtPayload, req: Request): Promise<string | null> {
  const header = req.headers.get('x-account-id');
  if (!header || header === 'all') return null;
  const acc = await prisma.account.findFirst({ where: { id: header, tenantId: jwt.tenant_id } });
  return acc ? acc.id : null;
}

// where-fragment for list queries: {} when consolidated, { accountId } when scoped.
export async function scopeWhere(jwt: JwtPayload, req: Request): Promise<{ accountId?: string }> {
  const active = await getActiveAccountId(jwt, req);
  return active ? { accountId: active } : {};
}

// Resolves the accountId to assign to a newly created record.
// Active account if set; otherwise the tenant's default ("Cuenta Principal").
export async function resolveCreateAccount(jwt: JwtPayload, req: Request): Promise<string> {
  const active = await getActiveAccountId(jwt, req);
  if (active) return active;

  let group = await prisma.accountGroup.findUnique({ where: { ownerTenantId: jwt.tenant_id } });
  if (!group) {
    group = await prisma.accountGroup.create({
      data: { ownerTenantId: jwt.tenant_id, name: 'Grupo empresarial' },
    });
  }
  let def = await prisma.account.findFirst({
    where: { accountGroupId: group.id }, orderBy: { createdAt: 'asc' },
  });
  if (!def) {
    def = await prisma.account.create({
      data: { accountGroupId: group.id, tenantId: jwt.tenant_id, name: 'Cuenta Principal', type: 'empresa' },
    });
  }
  return def.id;
}
