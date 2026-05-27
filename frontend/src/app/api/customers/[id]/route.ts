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
    const customer = await prisma.customer.findFirst({ where: { id, tenantId: jwt.tenant_id, ...scope } });
    if (!customer) return Response.json({ message: 'Cliente no encontrado' }, { status: 404 });

    const invoices = await prisma.invoice.findMany({
      where: { customerId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    const messages = await prisma.messageLog.findMany({
      where: { customerId: id, tenantId: jwt.tenant_id },
      orderBy: { sentAt: 'desc' }, take: 25,
    });
    const notes = await prisma.customerNote.findMany({
      where: { customerId: id, tenantId: jwt.tenant_id },
      orderBy: { createdAt: 'desc' },
    });

    // Computed stats
    const totalBought = invoices.reduce((s, i) => s + i.total, 0);
    const lastInvoice = invoices[0];
    const lastPurchase = lastInvoice?.createdAt ?? null;
    const now = Date.now();
    const daysSince = lastPurchase ? Math.floor((now - new Date(lastPurchase).getTime()) / 86400000) : null;

    let churnRisk: string;
    if (daysSince === null) churnRisk = 'nuevo';
    else if (daysSince > 60) churnRisk = 'alto';
    else if (daysSince > 30) churnRisk = 'medio';
    else churnRisk = 'bajo';

    const overdue = invoices.filter(i => i.paymentStatus !== 'paid' && i.dueDate && new Date(i.dueDate) < new Date());

    // Products bought aggregate
    const prodMap = new Map<string, { name: string; qty: number; total: number }>();
    for (const inv of invoices) {
      for (const it of inv.items) {
        const key = it.description;
        const cur = prodMap.get(key) ?? { name: key, qty: 0, total: 0 };
        cur.qty += it.quantity; cur.total += it.total;
        prodMap.set(key, cur);
      }
    }
    const productsBought = [...prodMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    // AI next-action suggestion (rule-based)
    let nextAction = 'Cliente al día. Mantén el contacto comercial.';
    if (churnRisk === 'nuevo') nextAction = 'Cliente sin compras. Crea su primera factura o envíale una oferta de bienvenida.';
    else if (churnRisk === 'alto') nextAction = `Sin comprar hace ${daysSince} días. Envía un mensaje de recompra por WhatsApp.`;
    else if (churnRisk === 'medio') nextAction = `Última compra hace ${daysSince} días. Buen momento para un seguimiento comercial.`;
    if (overdue.length > 0) nextAction = `Tiene ${overdue.length} factura(s) vencida(s). Envía un recordatorio de cobro.`;

    return Response.json({
      customer,
      stats: {
        totalBought,
        invoiceCount: invoices.length,
        lastPurchase,
        daysSinceLastPurchase: daysSince,
        churnRisk,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s, i) => s + i.total, 0),
        avgTicket: invoices.length ? Math.round(totalBought / invoices.length) : 0,
      },
      nextAction,
      invoices: invoices.map(i => ({
        id: i.id, invoiceNumber: i.invoiceNumber, total: i.total,
        status: i.status, paymentStatus: i.paymentStatus,
        invoiceDate: i.invoiceDate, dueDate: i.dueDate, createdAt: i.createdAt,
      })),
      productsBought,
      messages,
      notes,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { id } = await params;
    const scope = await scopeWhere(jwt, req);
    const existing = await prisma.customer.findFirst({ where: { id, tenantId: jwt.tenant_id, ...scope } });
    if (!existing) return Response.json({ message: 'Cliente no encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};
    for (const f of ['name', 'email', 'phone', 'taxId', 'address', 'city']) if (f in body) data[f] = body[f];
    if ('vip' in body) data.vip = !!body.vip;
    if ('status' in body) data.status = body.status === 'inactive' ? 'inactive' : 'active';

    const customer = await prisma.customer.update({ where: { id }, data });
    return Response.json(customer);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
