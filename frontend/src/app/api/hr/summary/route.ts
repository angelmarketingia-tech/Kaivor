import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { checkHrPlan, hrLocked } from '@/lib/hr';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);

  try {
    const tid = jwt.tenant_id;
    const employees = await prisma.employee.findMany({ where: { tenantId: tid } });
    const activeEmployees = employees.filter(e => e.status === 'active').length;

    const periods = await prisma.payrollPeriod.findMany({ where: { tenantId: tid } });
    const draftPayrolls = periods.filter(p => p.status === 'draft' || p.status === 'calculated').length;
    const unpaidPayrolls = periods.filter(p => ['approved', 'partially_paid'].includes(p.status));
    const pendingPayrollAmount = unpaidPayrolls.reduce((s, p) => s + p.totalNet, 0);

    const balances = await prisma.employeeBalance.findMany({ where: { tenantId: tid, status: 'pending' } });
    const pendingBalanceAmount = balances.reduce((s, b) => s + b.amount, 0);

    const vacancies = await prisma.vacancy.findMany({ where: { tenantId: tid } });
    const openVacancies = vacancies.filter(v => v.status === 'open').length;

    const deptCounts: Record<string, number> = {};
    for (const e of employees) {
      const d = e.department || 'Sin área';
      deptCounts[d] = (deptCounts[d] ?? 0) + 1;
    }

    return Response.json({
      plan,
      employees: { total: employees.length, active: activeEmployees },
      payroll: { drafts: draftPayrolls, pendingAmount: pendingPayrollAmount, pendingCount: unpaidPayrolls.length },
      balances: { pendingCount: balances.length, pendingAmount: pendingBalanceAmount },
      vacancies: { open: openVacancies, total: vacancies.length },
      departments: Object.entries(deptCounts).map(([name, count]) => ({ name, count })),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
