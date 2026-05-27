import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const existing = await prisma.automation.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!existing) return Response.json({ message: 'Automatización no encontrada' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ['name', 'description']) if (f in body) data[f] = body[f];
    if ('status' in body) data.status = body.status === 'paused' ? 'paused' : 'active';
    if ('actions' in body && Array.isArray(body.actions)) data.actions = body.actions;
    if ('conditions' in body) data.conditions = body.conditions;

    const automation = await prisma.automation.update({ where: { id }, data });
    return Response.json(automation);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const existing = await prisma.automation.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!existing) return Response.json({ message: 'Automatización no encontrada' }, { status: 404 });
    await prisma.automation.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
