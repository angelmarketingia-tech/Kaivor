import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const MAX_BASE64_LEN = 1_400_000; // ~1MB actual file
const ALLOWED_PREFIXES = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/webp'];

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { logoData, fileName, width, height } = await req.json();
    if (!logoData || typeof logoData !== 'string') {
      return Response.json({ message: 'No pudimos subir el logo. Verifica que sea PNG.' }, { status: 400 });
    }
    if (!ALLOWED_PREFIXES.some(p => logoData.startsWith(p))) {
      return Response.json({ message: 'Formato no válido. Usa PNG, JPG o WebP.' }, { status: 400 });
    }
    if (logoData.length > MAX_BASE64_LEN) {
      return Response.json({ message: 'El archivo es demasiado pesado. Máximo ~1MB.' }, { status: 400 });
    }

    const branding = await prisma.companyBranding.upsert({
      where: { tenantId: jwt.tenant_id },
      create: {
        tenantId: jwt.tenant_id,
        logoData,
        logoFileName: fileName || 'logo.png',
        logoWidth: width ? Math.round(width) : null,
        logoHeight: height ? Math.round(height) : null,
      },
      update: {
        logoData,
        logoFileName: fileName || 'logo.png',
        logoWidth: width ? Math.round(width) : null,
        logoHeight: height ? Math.round(height) : null,
      },
    });
    return Response.json(branding);
  } catch (err: any) {
    return Response.json({ message: 'No pudimos subir el logo. Verifica que sea PNG y que el archivo no sea demasiado pesado.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const existing = await prisma.companyBranding.findUnique({ where: { tenantId: jwt.tenant_id } });
    if (!existing) return Response.json({ message: 'Sin logo' }, { status: 404 });
    const branding = await prisma.companyBranding.update({
      where: { tenantId: jwt.tenant_id },
      data: { logoData: null, logoFileName: null, logoWidth: null, logoHeight: null },
    });
    return Response.json(branding);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
