import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { checkHrPlan, hrLocked } from '@/lib/hr';
import { scopeWhere, resolveCreateAccount } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const scope = await scopeWhere(jwt, req);
    const balances = await prisma.employeeBalance.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const pending = balances.filter(b => b.status === 'pending');
    return Response.json({
      balances,
      summary: {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s, b) => s + b.amount, 0),
      },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const b = await req.json();
    if (!b.employeeId || !b.type || !b.amount) {
      return Response.json({ message: 'Empleado, tipo y monto son requeridos' }, { status: 400 });
    }
    const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId: jwt.tenant_id } });
    if (!emp) return Response.json({ message: 'Empleado no encontrado' }, { status: 404 });
    const accountId = await resolveCreateAccount(jwt, req);
    const balance = await prisma.employeeBalance.create({
      data: {
        tenantId: jwt.tenant_id, accountId, employeeId: b.employeeId,
        type: b.type, amount: Number(b.amount),
        dueDate: b.dueDate ? new Date(b.dueDate) : null,
        notes: b.notes || null,
      },
    });
    return Response.json(balance, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id, status } = await req.json();
    const balance = await prisma.employeeBalance.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!balance) return Response.json({ message: 'Saldo no encontrado' }, { status: 404 });
    const updated = await prisma.employeeBalance.update({
      where: { id }, data: { status: ['pending', 'paid', 'cancelled'].includes(status) ? status : balance.status },
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
