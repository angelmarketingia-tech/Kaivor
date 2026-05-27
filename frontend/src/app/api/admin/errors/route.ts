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
    const errors = await prisma.errorReport.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const counts = {
      open: await prisma.errorReport.count({ where: { status: 'open' } }),
      investigating: await prisma.errorReport.count({ where: { status: 'investigating' } }),
      resolved: await prisma.errorReport.count({ where: { status: 'resolved' } }),
    };
    return Response.json({ errors, counts });
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
    const { id, status } = await req.json();
    if (!id) return Response.json({ message: 'id requerido' }, { status: 400 });
    const data: any = { status };
    if (status === 'resolved') data.resolvedAt = new Date();
    const updated = await prisma.errorReport.update({ where: { id }, data });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
