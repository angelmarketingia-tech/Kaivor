import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const where: any = {};
    if (status && status !== 'all') where.status = status;
    const tickets = await prisma.supportTicket.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const counts = {
      open: await prisma.supportTicket.count({ where: { status: 'open' } }),
      in_progress: await prisma.supportTicket.count({ where: { status: 'in_progress' } }),
      resolved: await prisma.supportTicket.count({ where: { status: 'resolved' } }),
    };
    return Response.json({ tickets, counts });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  try {
    const { id, status, response, priority } = await req.json();
    if (!id) return Response.json({ message: 'id requerido' }, { status: 400 });
    const data: any = {};
    if (status) data.status = status;
    if (response !== undefined) data.response = response;
    if (priority) data.priority = priority;
    if (status === 'resolved' || status === 'closed') data.resolvedAt = new Date();
    const updated = await prisma.supportTicket.update({ where: { id }, data });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
