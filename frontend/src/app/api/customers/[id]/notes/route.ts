import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const notes = await prisma.customerNote.findMany({
      where: { customerId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(notes);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const { body } = await req.json();
    if (!body || !body.trim()) return Response.json({ message: 'La nota no puede estar vacía' }, { status: 400 });

    const customer = await prisma.customer.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!customer) return Response.json({ message: 'Cliente no encontrado' }, { status: 404 });

    const user = await prisma.user.findFirst({ where: { id: jwt.sub, tenantId: jwt.tenant_id } });
    const note = await prisma.customerNote.create({
      data: {
        tenantId: jwt.tenant_id, customerId: id, userId: jwt.sub,
        authorName: user?.name ?? null, body: body.trim(),
      },
    });
    return Response.json(note, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
