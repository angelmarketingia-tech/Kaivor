import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from "@/lib/account-scope";
import { checkHrPlan, hrLocked } from '@/lib/hr';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id } = await params;
    const employee = await prisma.employee.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!employee) return Response.json({ message: 'Empleado no encontrado' }, { status: 404 });

    const payrollItems = await prisma.payrollItem.findMany({
      where: { employeeId: id, tenantId: jwt.tenant_id },
      include: { period: { select: { name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const balances = await prisma.employeeBalance.findMany({
      where: { employeeId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });
    const pendingBalance = balances.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);

    return Response.json({ employee, payrollItems, balances, pendingBalance });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id } = await params;
    const existing = await prisma.employee.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!existing) return Response.json({ message: 'Empleado no encontrado' }, { status: 404 });

    const b = await req.json();
    const data: Record<string, any> = {};
    for (const f of ['firstName', 'lastName', 'documentType', 'documentNumber', 'email', 'phone',
      'address', 'position', 'department', 'contractType', 'status', 'notes',
      'emergencyContactName', 'emergencyContactPhone']) {
      if (f in b) data[f] = b[f] || null;
    }
    if ('salary' in b) data.salary = Number(b.salary) || 0;
    if ('startDate' in b) data.startDate = b.startDate ? new Date(b.startDate) : null;
    if ('endDate' in b) data.endDate = b.endDate ? new Date(b.endDate) : null;

    const employee = await prisma.employee.update({ where: { id }, data });
    return Response.json(employee);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
