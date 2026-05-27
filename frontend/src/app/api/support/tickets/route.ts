import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

// Any authenticated user can report a problem.
export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { category, subject, description, priority } = await req.json();
    if (!subject?.trim() || !description?.trim()) {
      return Response.json({ message: 'Asunto y descripción son requeridos' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: jwt.tenant_id,
        userId: jwt.sub,
        reporterName: user?.name ?? user?.email ?? null,
        category: ['bug', 'question', 'billing', 'feature', 'other'].includes(category) ? category : 'bug',
        subject: subject.trim().slice(0, 200),
        description: description.trim().slice(0, 2000),
        priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      },
    });
    return Response.json(ticket, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// Users can see their own tenant's tickets.
export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return Response.json(tickets);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
