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
    const vacancies = await prisma.vacancy.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      orderBy: { createdAt: 'desc' },
      include: { candidates: { select: { id: true, stage: true } } },
    });
    return Response.json(vacancies.map(v => ({
      ...v,
      candidateCount: v.candidates.length,
      hiredCount: v.candidates.filter(c => c.stage === 'hired').length,
      candidates: undefined,
    })));
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
    if (!b.title?.trim()) return Response.json({ message: 'El título es requerido' }, { status: 400 });
    const accountId = await resolveCreateAccount(jwt, req);
    const vacancy = await prisma.vacancy.create({
      data: {
        tenantId: jwt.tenant_id,
        accountId,
        title: b.title.trim(),
        department: b.department || null,
        location: b.location || null,
        employmentType: b.employmentType || null,
        salaryRange: b.salaryRange || null,
        description: b.description || null,
        requirements: b.requirements || null,
        createdBy: jwt.sub,
      },
    });
    return Response.json(vacancy, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
