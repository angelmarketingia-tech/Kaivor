import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';

function publicShape(s: any) {
  if (!s) {
    return {
      waMode: 'manual', waCountryCode: '57', waBusinessPhone: null,
      smtpHost: null, smtpPort: null, smtpUser: null, smtpSecure: true,
      emailFromName: null, emailFromAddr: null,
      emailConfigured: false, hasSmtpPass: false,
    };
  }
  const emailConfigured = !!(s.smtpHost && s.smtpUser && s.smtpPassEnc);
  return {
    waMode: s.waMode, waCountryCode: s.waCountryCode, waBusinessPhone: s.waBusinessPhone,
    smtpHost: s.smtpHost, smtpPort: s.smtpPort, smtpUser: s.smtpUser, smtpSecure: s.smtpSecure,
    emailFromName: s.emailFromName, emailFromAddr: s.emailFromAddr,
    emailConfigured, hasSmtpPass: !!s.smtpPassEnc,
  };
}

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const s = await prisma.tenantSettings.findUnique({ where: { tenantId: jwt.tenant_id } });
    return Response.json(publicShape(s));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const body = await req.json();
    const data: Record<string, any> = {};
    const strFields = ['waMode', 'waCountryCode', 'waBusinessPhone', 'smtpHost', 'smtpUser', 'emailFromName', 'emailFromAddr'];
    for (const f of strFields) if (f in body) data[f] = body[f] || null;
    if ('smtpPort' in body) data.smtpPort = body.smtpPort ? Number(body.smtpPort) : null;
    if ('smtpSecure' in body) data.smtpSecure = !!body.smtpSecure;
    // Encrypt SMTP password only if a new plaintext value is sent
    if (body.smtpPass) data.smtpPassEnc = encrypt(String(body.smtpPass));

    const s = await prisma.tenantSettings.upsert({
      where: { tenantId: jwt.tenant_id },
      create: { tenantId: jwt.tenant_id, ...data },
      update: data,
    });
    return Response.json(publicShape(s));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
