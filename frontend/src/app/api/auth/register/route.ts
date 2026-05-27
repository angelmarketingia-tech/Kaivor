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
    const name = String(body.name || '').trim();
    const companyName = String(body.companyName || '').trim();

    if (!email || !password || !name) {
      return Response.json({ message: 'Completa tu nombre, correo y contraseña.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ message: 'El correo electrónico no es válido.' }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ message: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    // Case-insensitive duplicate check (catches mixed-case existing accounts too)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      return Response.json({ message: 'Este correo ya está registrado. Inicia sesión.' }, { status: 400 });
    }

    const baseSlug = (email.split('@')[0] || 'kaivor').replace(/[^a-z0-9]/g, '') || 'kaivor';
    const slug = `${baseSlug}-${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: { slug, name: companyName || name, plan: 'FREE' },
    });

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, tenantId: tenant.id, role: 'admin' },
    });

    await prisma.company.create({
      data: { tenantId: tenant.id, name: companyName || name, taxId: `TEMP-${tenant.id.slice(0, 8)}` },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.create({
      data: { tenantId: tenant.id, plan: 'FREE', status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd },
    });

    const token = signToken({ sub: user.id, email: user.email, tenant_id: tenant.id, role: user.role });
    await recordEvent('register', { tenantId: tenant.id, userId: user.id });
    return Response.json({
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: tenant.id, plan: 'FREE', platformRole: null },
    });
  } catch (err: any) {
    console.error('register error', err);
    return Response.json({ message: 'Error al crear la cuenta' }, { status: 500 });
  }
}
