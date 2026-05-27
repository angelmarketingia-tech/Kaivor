import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { runAutomation } from '@/lib/automation-runner';

// Manual "run now" — executes a single automation for the current tenant.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const automation = await prisma.automation.findFirst({ where: { id, tenantId: jwt.tenant_id } });
    if (!automation) return Response.json({ message: 'Automatización no encontrada' }, { status: 404 });

    const result = await runAutomation(automation);
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
