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
    const periods = await prisma.payrollPeriod.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { id: true } } },
    });
    return Response.json(periods.map(p => ({ ...p, itemCount: p.items.length, items: undefined })));
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
    if (!b.name?.trim() || !b.startDate || !b.endDate) {
      return Response.json({ message: 'Nombre, fecha inicio y fin son requeridos' }, { status: 400 });
    }
    const accountId = await resolveCreateAccount(jwt, req);
    const period = await prisma.payrollPeriod.create({
      data: {
        tenantId: jwt.tenant_id,
        accountId,
        name: b.name.trim(),
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        paymentDate: b.paymentDate ? new Date(b.paymentDate) : null,
      },
    });

    // Optionally seed with all active employees
    if (b.includeAllActive) {
      const employees = await prisma.employee.findMany({ where: { tenantId: jwt.tenant_id, status: 'active' } });
      for (const e of employees) {
        await prisma.payrollItem.create({
          data: {
            tenantId: jwt.tenant_id, payrollPeriodId: period.id, employeeId: e.id,
            baseSalary: e.salary, netPay: e.salary,
          },
        });
      }
    }
    return Response.json(period, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
