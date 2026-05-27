import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

// Returns real Integration records (used by dashboard) — kept array-shaped.
export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const integrations = await prisma.integration.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(integrations);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
