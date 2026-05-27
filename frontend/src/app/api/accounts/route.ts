import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const MANAGE_ROLES = ['owner', 'admin', 'account_admin'];

// GET ensures an AccountGroup exists for the tenant, then returns group + accounts.
export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    let group = await prisma.accountGroup.findUnique({ where: { ownerTenantId: jwt.tenant_id } });
    if (!group) {
      const tenant = await prisma.tenant.findUnique({ where: { id: jwt.tenant_id } });
      group = await prisma.accountGroup.create({
        data: { ownerTenantId: jwt.tenant_id, name: tenant?.name ? `Grupo ${tenant.name}` : 'Grupo empresarial' },
      });
    }
    const accounts = await prisma.account.findMany({
      where: { accountGroupId: group.id },
      orderBy: { createdAt: 'asc' },
      include: { memberships: { select: { id: true } } },
    });
    return Response.json({
      group,
      accounts: accounts.map(a => ({ ...a, memberCount: a.memberships.length, memberships: undefined })),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// POST creates a child account.
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
    if (!user || !MANAGE_ROLES.includes(user.role)) {
      return Response.json({ message: 'Solo un administrador puede crear cuentas.' }, { status: 403 });
    }
    const b = await req.json();
    if (!b.name?.trim()) return Response.json({ message: 'El nombre es requerido' }, { status: 400 });

    let group = await prisma.accountGroup.findUnique({ where: { ownerTenantId: jwt.tenant_id } });
    if (!group) {
      group = await prisma.accountGroup.create({ data: { ownerTenantId: jwt.tenant_id, name: 'Grupo empresarial' } });
    }
    const account = await prisma.account.create({
      data: {
        accountGroupId: group.id, tenantId: jwt.tenant_id,
        name: b.name.trim(), type: b.type || 'sede',
        country: b.country || 'Colombia', currency: b.currency || 'COP',
      },
    });
    return Response.json(account, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
