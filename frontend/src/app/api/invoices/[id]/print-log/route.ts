import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const { type = 'receipt', paperSize = '80mm' } = await req.json().catch(() => ({}));
    const log = await prisma.printLog.create({
      data: { tenantId: jwt.tenant_id, invoiceId: id, userId: jwt.sub, type, paperSize },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id,
        userId: jwt.sub,
        action: 'printed',
        resourceType: 'invoice',
        resourceId: id,
        changes: { type, paperSize },
      },
    });
    return Response.json(log, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
