import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const MANAGE_ROLES = ['owner', 'admin', 'account_admin'];
const ACCOUNT_ROLES = ['owner', 'admin', 'manager', 'accountant', 'cashier', 'hr_manager', 'viewer'];

async function ownsAccount(tenantId: string, id: string) {
  return prisma.account.findFirst({ where: { id, tenantId } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const account = await ownsAccount(jwt.tenant_id, id);
    if (!account) return Response.json({ message: 'Cuenta no encontrada' }, { status: 404 });
    const memberships = await prisma.accountMembership.findMany({
      where: { accountId: id }, orderBy: { createdAt: 'asc' },
    });
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId: jwt.tenant_id, isActive: true },
      select: { id: true, name: true, email: true },
    });
    return Response.json({ account, memberships, tenantUsers });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH actions: update-account, deactivate, add-member, remove-member, change-role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const account = await ownsAccount(jwt.tenant_id, id);
    if (!account) return Response.json({ message: 'Cuenta no encontrada' }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
    if (!user || !MANAGE_ROLES.includes(user.role)) {
      return Response.json({ message: 'Solo un administrador puede gestionar cuentas.' }, { status: 403 });
    }
    const b = await req.json();

    if (b.action === 'update-account') {
      const data: Record<string, any> = {};
      for (const f of ['name', 'type', 'status', 'country', 'currency']) if (f in b) data[f] = b[f];
      const updated = await prisma.account.update({ where: { id }, data });
      return Response.json(updated);
    }

    if (b.action === 'add-member') {
      const member = await prisma.user.findFirst({ where: { id: b.userId, tenantId: jwt.tenant_id } });
      if (!member) return Response.json({ message: 'Usuario no encontrado' }, { status: 404 });
      const dup = await prisma.accountMembership.findFirst({ where: { accountId: id, userId: b.userId } });
      if (dup) return Response.json({ message: 'El usuario ya tiene acceso a esta cuenta' }, { status: 400 });
      const role = ACCOUNT_ROLES.includes(b.role) ? b.role : 'viewer';
      const membership = await prisma.accountMembership.create({
        data: { tenantId: jwt.tenant_id, accountId: id, userId: b.userId, userName: member.name ?? member.email, role },
      });
      return Response.json(membership, { status: 201 });
    }

    if (b.action === 'change-role') {
      const m = await prisma.accountMembership.findFirst({ where: { id: b.membershipId, accountId: id } });
      if (!m) return Response.json({ message: 'Acceso no encontrado' }, { status: 404 });
      const updated = await prisma.accountMembership.update({
        where: { id: b.membershipId },
        data: { role: ACCOUNT_ROLES.includes(b.role) ? b.role : m.role },
      });
      return Response.json(updated);
    }

    if (b.action === 'remove-member') {
      await prisma.accountMembership.delete({ where: { id: b.membershipId } });
      return Response.json({ ok: true });
    }

    return Response.json({ message: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
