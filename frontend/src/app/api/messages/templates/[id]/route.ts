import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!existing) return Response.json({ message: 'Plantilla no encontrada' }, { status: 404 });
    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ['name', 'subject', 'body', 'active']) if (f in body) data[f] = body[f];
    const template = await prisma.messageTemplate.update({ where: { id }, data });
    return Response.json(template);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!existing) return Response.json({ message: 'Plantilla no encontrada' }, { status: 404 });
    await prisma.messageTemplate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
