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
    const period = await prisma.payrollPeriod.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!period) return Response.json({ message: 'Periodo no encontrado' }, { status: 404 });
    const items = await prisma.payrollItem.findMany({
      where: { payrollPeriodId: id, tenantId: jwt.tenant_id },
      include: { employee: { select: { firstName: true, lastName: true, position: true, email: true, phone: true, documentNumber: true } } },
    });
    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    const branding = await prisma.companyBranding.findUnique({ where: { tenantId: jwt.tenant_id } });
    return Response.json({ period, items, company, branding });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH actions: add-employee, update-item, remove-item, calculate, approve, mark-paid, cancel
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id } = await params;
    const period = await prisma.payrollPeriod.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!period) return Response.json({ message: 'Periodo no encontrado' }, { status: 404 });
    const b = await req.json();

    if (b.action === 'add-employee') {
      const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId: jwt.tenant_id } });
      if (!emp) return Response.json({ message: 'Empleado no encontrado' }, { status: 404 });
      const dup = await prisma.payrollItem.findFirst({ where: { payrollPeriodId: id, employeeId: b.employeeId } });
      if (dup) return Response.json({ message: 'El empleado ya está en este periodo' }, { status: 400 });
      const item = await prisma.payrollItem.create({
        data: {
          tenantId: jwt.tenant_id, payrollPeriodId: id, employeeId: b.employeeId,
          baseSalary: emp.salary, netPay: emp.salary,
        },
      });
      return Response.json(item);
    }

    if (b.action === 'update-item') {
      const item = await prisma.payrollItem.findFirst({ where: { id: b.itemId, payrollPeriodId: id } });
      if (!item) return Response.json({ message: 'Ítem no encontrado' }, { status: 404 });
      const earnings = Number(b.earnings) || 0;
      const deductions = Number(b.deductions) || 0;
      const updated = await prisma.payrollItem.update({
        where: { id: b.itemId },
        data: { earnings, deductions, netPay: item.baseSalary + earnings - deductions, notes: b.notes ?? item.notes },
      });
      return Response.json(updated);
    }

    if (b.action === 'remove-item') {
      await prisma.payrollItem.delete({ where: { id: b.itemId } });
      return Response.json({ ok: true });
    }

    if (b.action === 'calculate') {
      const items = await prisma.payrollItem.findMany({ where: { payrollPeriodId: id } });
      let gross = 0, ded = 0, net = 0;
      for (const it of items) {
        const itemNet = it.baseSalary + it.earnings - it.deductions;
        gross += it.baseSalary + it.earnings;
        ded += it.deductions;
        net += itemNet;
        if (itemNet !== it.netPay) {
          await prisma.payrollItem.update({ where: { id: it.id }, data: { netPay: itemNet } });
        }
      }
      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: { status: 'calculated', totalGross: gross, totalDeductions: ded, totalNet: net },
      });
      return Response.json(updated);
    }

    if (b.action === 'approve') {
      const updated = await prisma.payrollPeriod.update({ where: { id }, data: { status: 'approved' } });
      return Response.json(updated);
    }

    if (b.action === 'mark-paid') {
      const items = await prisma.payrollItem.findMany({ where: { payrollPeriodId: id } });
      for (const it of items) {
        if (it.status !== 'paid') await prisma.payrollItem.update({ where: { id: it.id }, data: { status: 'paid' } });
      }
      const updated = await prisma.payrollPeriod.update({
        where: { id }, data: { status: 'paid', paymentDate: new Date() },
      });
      await prisma.auditLog.create({
        data: { tenantId: jwt.tenant_id, userId: jwt.sub, action: 'updated', resourceType: 'payroll', resourceId: id, changes: { status: 'paid' } },
      }).catch(() => {});
      return Response.json(updated);
    }

    if (b.action === 'cancel') {
      const updated = await prisma.payrollPeriod.update({ where: { id }, data: { status: 'cancelled' } });
      return Response.json(updated);
    }

    return Response.json({ message: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
