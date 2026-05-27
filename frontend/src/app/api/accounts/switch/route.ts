import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { recordEvent } from '@/lib/admin';

// Switches the active account context. Validates the account belongs to the tenant.
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { accountId } = await req.json();
    if (!accountId) return Response.json({ message: 'accountId requerido' }, { status: 400 });
    const account = await prisma.account.findFirst({ where: { id: accountId, tenantId: jwt.tenant_id } });
    if (!account) return Response.json({ message: 'Cuenta no encontrada' }, { status: 404 });
    if (account.status !== 'active') {
      return Response.json({ message: 'Esta cuenta está inactiva' }, { status: 400 });
    }
    await recordEvent('account_switch', { tenantId: jwt.tenant_id, userId: jwt.sub, metadata: { accountId } });
    return Response.json({ ok: true, account: { id: account.id, name: account.name, type: account.type } });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
