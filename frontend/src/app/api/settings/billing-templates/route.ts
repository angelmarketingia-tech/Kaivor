import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const settings = await prisma.billingTemplateSettings.findUnique({ where: { tenantId: jwt.tenant_id } });
    return Response.json(settings ?? {
      showLogo: true, receiptSize: '80mm',
      receiptFooterMessage: 'Gracias por su compra.',
      invoiceLegalNote: null, showQr: false, showDianData: true,
      showCashierName: true, showCustomerPhone: true,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    const settings = await prisma.billingTemplateSettings.upsert({
      where: { tenantId: jwt.tenant_id },
      create: { tenantId: jwt.tenant_id, ...body },
      update: body,
    });
    return Response.json(settings);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
