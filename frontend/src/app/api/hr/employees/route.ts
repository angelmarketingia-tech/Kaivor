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
    const employees = await prisma.employee.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(employees);
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
    if (!b.firstName?.trim() || !b.lastName?.trim()) {
      return Response.json({ message: 'Nombre y apellido son requeridos' }, { status: 400 });
    }
    const accountId = await resolveCreateAccount(jwt, req);
    const employee = await prisma.employee.create({
      data: {
        tenantId: jwt.tenant_id,
        accountId,
        firstName: b.firstName.trim(),
        lastName: b.lastName.trim(),
        documentType: b.documentType || null,
        documentNumber: b.documentNumber || null,
        email: b.email || null,
        phone: b.phone || null,
        address: b.address || null,
        position: b.position || null,
        department: b.department || null,
        salary: Number(b.salary) || 0,
        contractType: b.contractType || null,
        startDate: b.startDate ? new Date(b.startDate) : null,
        emergencyContactName: b.emergencyContactName || null,
        emergencyContactPhone: b.emergencyContactPhone || null,
        notes: b.notes || null,
      },
    });
    return Response.json(employee, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
