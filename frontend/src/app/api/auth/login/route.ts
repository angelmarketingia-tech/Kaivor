import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { recordEvent } from '@/lib/admin';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return Response.json({ message: 'Ingresa tu correo y contraseña.' }, { status: 400 });
    }

    // Case-insensitive lookup so login works regardless of how the email was typed
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
      include: { tenant: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ message: 'Correo o contraseña incorrectos.' }, { status: 401 });
    }

    // Block login if the company was suspended (platform staff bypass this)
    if (user.tenant && !user.tenant.isActive && !user.platformRole) {
      return Response.json({ message: 'Tu cuenta está suspendida. Contacta a soporte de Kaivor.' }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: user.tenantId } });
    const plan = subscription?.plan ?? 'FREE';

    const token = signToken({ sub: user.id, email: user.email, tenant_id: user.tenantId, role: user.role });
    await recordEvent('login', { tenantId: user.tenantId, userId: user.id });
    return Response.json({
      access_token: token,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        tenantId: user.tenantId, plan, platformRole: user.platformRole ?? null,
      },
    });
  } catch (err: any) {
    console.error('login error', err);
    return Response.json({ message: 'Error al iniciar sesión' }, { status: 500 });
  }
}
