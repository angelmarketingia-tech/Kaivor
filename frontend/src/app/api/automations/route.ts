import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const VALID_TRIGGERS = ['invoice_overdue', 'low_stock', 'customer_inactive', 'invoice_created', 'product_expiring', 'onboarding_incomplete'];

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const automations = await prisma.automation.findMany({
      where: { tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
      include: { runs: { orderBy: { executedAt: 'desc' }, take: 5 } },
    });
    return Response.json(automations);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { name, description, trigger, conditions, actions } = await req.json();
    if (!name || !trigger) return Response.json({ message: 'Nombre y disparador son requeridos' }, { status: 400 });
    if (!VALID_TRIGGERS.includes(trigger)) return Response.json({ message: 'Disparador no válido' }, { status: 400 });
    if (!Array.isArray(actions) || actions.length === 0) {
      return Response.json({ message: 'Selecciona al menos una acción' }, { status: 400 });
    }
    const automation = await prisma.automation.create({
      data: {
        tenantId: jwt.tenant_id, name, description: description || null,
        trigger, conditions: conditions || undefined, actions, createdBy: jwt.sub,
      },
    });
    return Response.json(automation, { status: 201 });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
