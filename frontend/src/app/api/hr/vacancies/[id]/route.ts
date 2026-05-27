import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from "@/lib/account-scope";
import { checkHrPlan, hrLocked } from '@/lib/hr';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id } = await params;
    const vacancy = await prisma.vacancy.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!vacancy) return Response.json({ message: 'Vacante no encontrada' }, { status: 404 });
    const candidates = await prisma.candidate.findMany({
      where: { vacancyId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ vacancy, candidates });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH actions: update-vacancy, add-candidate, update-candidate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);
  try {
    const { id } = await params;
    const vacancy = await prisma.vacancy.findFirst({ where: { id, tenantId: jwt.tenant_id, ...(await scopeWhere(jwt, req)) } });
    if (!vacancy) return Response.json({ message: 'Vacante no encontrada' }, { status: 404 });
    const b = await req.json();

    if (b.action === 'update-vacancy') {
      const data: Record<string, any> = {};
      for (const f of ['title', 'department', 'location', 'employmentType', 'salaryRange', 'description', 'requirements', 'status']) {
        if (f in b) data[f] = b[f];
      }
      const updated = await prisma.vacancy.update({ where: { id }, data });
      return Response.json(updated);
    }

    if (b.action === 'add-candidate') {
      if (!b.firstName?.trim() || !b.lastName?.trim()) {
        return Response.json({ message: 'Nombre y apellido del candidato son requeridos' }, { status: 400 });
      }
      const candidate = await prisma.candidate.create({
        data: {
          tenantId: jwt.tenant_id, vacancyId: id,
          firstName: b.firstName.trim(), lastName: b.lastName.trim(),
          email: b.email || null, phone: b.phone || null, notes: b.notes || null,
        },
      });
      return Response.json(candidate, { status: 201 });
    }

    if (b.action === 'update-candidate') {
      const cand = await prisma.candidate.findFirst({ where: { id: b.candidateId, vacancyId: id } });
      if (!cand) return Response.json({ message: 'Candidato no encontrado' }, { status: 404 });
      const data: Record<string, any> = {};
      if (b.stage && STAGES.includes(b.stage)) data.stage = b.stage;
      if ('notes' in b) data.notes = b.notes;
      const updated = await prisma.candidate.update({ where: { id: b.candidateId }, data });
      return Response.json(updated);
    }

    return Response.json({ message: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
