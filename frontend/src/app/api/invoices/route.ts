import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { recordEvent } from '@/lib/admin';
import { scopeWhere, resolveCreateAccount } from '@/lib/account-scope';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const scope = await scopeWhere(jwt, req);
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: jwt.tenant_id, ...scope },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Response.json(invoices);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    const { customerId, items, paymentMethod, cashReceived, notes, dueDate,
      paymentReference, installments, customerDocument } = body;

    // Validations
    if (!customerId) return Response.json({ message: 'Cliente requerido' }, { status: 400 });
    if (!items || items.length === 0) return Response.json({ message: 'Agrega al menos un producto' }, { status: 400 });
    if (!paymentMethod) return Response.json({ message: 'Selecciona un método de pago' }, { status: 400 });

    const VALID_METHODS = ['cash', 'nequi', 'daviplata', 'debit_card', 'credit_card', 'qr', 'addi', 'credit_validation', 'bank_transfer', 'other'];
    if (!VALID_METHODS.includes(paymentMethod)) {
      return Response.json({ message: 'Método de pago no válido' }, { status: 400 });
    }
    const isCreditMethod = paymentMethod === 'addi' || paymentMethod === 'credit_validation';

    // Validate limit
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    const LIMITS: Record<string, number> = { FREE: 45, STARTER: 150, PRO_AI: 500, BUSINESS: -1, ENTERPRISE: -1 };
    const limit = LIMITS[plan] ?? 45;
    if (limit !== -1) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const usedCount = await prisma.invoice.count({ where: { tenantId: jwt.tenant_id, createdAt: { gte: monthStart } } });
      if (usedCount >= limit) return Response.json({ message: `Límite de ${limit} facturas alcanzado para el plan ${plan}. Mejora tu plan.` }, { status: 403 });
    }

    const company = await prisma.company.findFirst({ where: { tenantId: jwt.tenant_id } });
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: jwt.tenant_id } });
    if (!company) return Response.json({ message: 'Empresa no encontrada' }, { status: 400 });
    if (!customer) return Response.json({ message: 'Cliente no encontrado' }, { status: 400 });

    // Calculate totals
    const lineItems = items.map((it: any) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unitPrice) || 0;
      const discVal = Number(it.discountValue) || 0;
      const taxRate = Number(it.taxRate) || 0;
      const sub = qty * price;
      const discAmt = it.discountType === 'percent' ? sub * (discVal / 100) : discVal;
      const taxable = sub - discAmt;
      const taxAmt = taxable * (taxRate / 100);
      const total = taxable + taxAmt;
      return { qty, price, discAmt, taxAmt, sub, total, raw: it };
    });

    const subtotal = lineItems.reduce((s: number, i: any) => s + i.sub, 0);
    const discountAmount = lineItems.reduce((s: number, i: any) => s + i.discAmt, 0);
    const taxAmount = lineItems.reduce((s: number, i: any) => s + i.taxAmt, 0);
    const total = subtotal - discountAmount + taxAmount;

    if (total < 0) return Response.json({ message: 'El total no puede ser negativo' }, { status: 400 });

    const cashRec = paymentMethod === 'cash' ? Number(cashReceived) || total : null;
    const changeGiven = cashRec !== null ? Math.max(0, cashRec - total) : null;
    if (cashRec !== null && cashRec < total) return Response.json({ message: 'El valor recibido es menor al total' }, { status: 400 });

    // Generate sequential invoice number
    const count = await prisma.invoice.count({ where: { tenantId: jwt.tenant_id } });
    const year = new Date().getFullYear();
    const invoiceNumber = `FAC-${year}-${String(count + 1).padStart(6, '0')}`;

    // Get user
    const user = await prisma.user.findFirst({ where: { id: jwt.sub, tenantId: jwt.tenant_id } });

    // Account scoping
    const accountId = await resolveCreateAccount(jwt, req);

    // Create invoice + items + payment in sequence (Neon HTTP doesn't support transactions)
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: jwt.tenant_id,
        accountId,
        companyId: company.id,
        customerId,
        userId: user?.id ?? null,
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'sent',
        paymentStatus: isCreditMethod ? 'unpaid' : 'paid',
        paymentMethod,
        cashReceived: cashRec,
        changeGiven,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        notes: notes || null,
      },
    });

    // Create invoice items one by one (Neon HTTP adapter doesn't support transactions/createMany)
    for (const li of lineItems) {
      await prisma.invoiceItem.create({
        data: {
          tenantId: jwt.tenant_id,
          invoiceId: invoice.id,
          productId: (li as any).raw.productId || null,
          description: (li as any).raw.description || (li as any).raw.name || 'Producto/servicio',
          quantity: (li as any).qty,
          unitPrice: (li as any).price,
          discountType: (li as any).raw.discountType || null,
          discountValue: Number((li as any).raw.discountValue) || 0,
          taxRate: Number((li as any).raw.taxRate) || 0,
          taxAmount: (li as any).taxAmt,
          subtotal: (li as any).sub,
          total: (li as any).total,
        },
      });
    }

    // Create payment record. Honest status per method:
    //  - cash → confirmed
    //  - credit (addi/credit_validation) → requires_validation (not paid yet)
    //  - card/qr/nequi/daviplata/transfer → manual_registered (operational, no gateway charge)
    const paymentStatus = isCreditMethod ? 'requires_validation'
      : paymentMethod === 'cash' ? 'confirmed' : 'manual_registered';
    await prisma.payment.create({
      data: {
        tenantId: jwt.tenant_id,
        invoiceId: invoice.id,
        amount: total,
        method: paymentMethod,
        receivedAmount: cashRec,
        changeAmount: changeGiven,
        reference: paymentMethod === 'cash'
          ? `Efectivo recibido: ${cashRec}`
          : (paymentReference || null),
        status: paymentStatus,
        provider: 'manual',
        paidAt: new Date(),
      },
    });

    // For credit methods, register a credit validation request (honest: not approved)
    if (isCreditMethod) {
      await prisma.creditValidation.create({
        data: {
          tenantId: jwt.tenant_id,
          invoiceId: invoice.id,
          customerId,
          provider: paymentMethod === 'addi' ? 'addi' : 'internal',
          amount: total,
          installments: Number(installments) || 1,
          customerDocument: customerDocument || customer.taxId || null,
          requestedBy: user?.id ?? null,
          status: 'pending',
        },
      });
    }

    // Track usage event
    await prisma.usageEvent.create({
      data: { tenantId: jwt.tenant_id, eventType: 'invoice_created', quantity: 1, metadata: { invoiceId: invoice.id, invoiceNumber } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: jwt.tenant_id,
        userId: user?.id ?? null,
        action: 'created',
        resourceType: 'invoice',
        resourceId: invoice.id,
        changes: { invoiceNumber, total, customerId, paymentMethod },
      },
    });
    await recordEvent('invoice_created', { tenantId: jwt.tenant_id, userId: user?.id ?? null, metadata: { total } });

    // Return full invoice
    const full = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true,
        company: true,
        items: true,
        payments: true,
        user: { select: { name: true, email: true } },
      },
    });
    return Response.json(full, { status: 201 });
  } catch (err: any) {
    console.error('invoice create error', err);
    return Response.json({ message: err.message || 'Error al crear la factura' }, { status: 500 });
  }
}
