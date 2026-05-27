import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const DEFAULTS = {
  logoData: null, logoFileName: null, logoWidth: null, logoHeight: null,
  primaryColor: '#7c3aed', invoiceTemplate: 'moderno',
  logoPosition: 'left', logoSize: 'medium',
  showLogoOnInvoice: true, showLogoOnReceipt: true, showLogoOnPdf: true,
  footerMessage: 'Gracias por su compra.', legalNote: null,
};

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const branding = await prisma.companyBranding.findUnique({ where: { tenantId: jwt.tenant_id } });
    return Response.json(branding ?? DEFAULTS);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    // Whitelist updatable fields (never logoData here — that's the logo endpoint)
    const allowed = ['primaryColor', 'invoiceTemplate', 'logoPosition', 'logoSize',
      'showLogoOnInvoice', 'showLogoOnReceipt', 'showLogoOnPdf', 'footerMessage', 'legalNote'];
    const data: Record<string, any> = {};
    for (const k of allowed) if (k in body) data[k] = body[k];

    const branding = await prisma.companyBranding.upsert({
      where: { tenantId: jwt.tenant_id },
      create: { tenantId: jwt.tenant_id, ...data },
      update: data,
    });
    return Response.json(branding);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
