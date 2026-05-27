import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { scopeWhere } from '@/lib/account-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const scope = await scopeWhere(jwt, req);
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: jwt.tenant_id, ...scope },
      include: {
        customer: true,
        company: true,
        items: { orderBy: { subtotal: 'desc' } },
        payments: { orderBy: { paidAt: 'asc' } },
        deliveryLogs: { orderBy: { sentAt: 'desc' } },
        printLogs: { orderBy: { createdAt: 'desc' } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!invoice) return Response.json({ message: 'Factura no encontrada' }, { status: 404 });
    return Response.json(invoice);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
