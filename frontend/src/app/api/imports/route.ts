import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const jobs = await prisma.importJob.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return Response.json(jobs);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
