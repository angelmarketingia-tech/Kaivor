import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden } from '@/lib/admin';

const VALID_PLANS = ['FREE', 'STARTER', 'PRO_AI', 'BUSINESS', 'ENTERPRISE'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();
  try {
    const { id } = await params;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return Response.json({ message: 'Empresa no encontrada' }, { status: 404 });
    const [sub, users, company, invoiceCount, memberships] = [
      await prisma.subscription.findUnique({ where: { tenantId: id } }),
      await prisma.user.findMany({ where: { tenantId: id }, select: { id: true, name: true, email: true, role: true } }),
      await prisma.company.findFirst({ where: { tenantId: id } }),
      await prisma.invoice.count({ where: { tenantId: id } }),
      await prisma.membershipInvoice.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' } }),
    ];
    return Response.json({ tenant, subscription: sub, users, company, invoiceCount, memberships });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

// PATCH handles: change-plan, suspend, reactivate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt, ['platform_superadmin', 'platform_admin', 'platform_billing']);
  if (!staff) return adminForbidden();
  try {
    const { id } = await params;
    const { action, plan } = await req.json();
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return Response.json({ message: 'Empresa no encontrada' }, { status: 404 });

    if (action === 'change-plan') {
      if (!VALID_PLANS.includes(plan)) return Response.json({ message: 'Plan no válido' }, { status: 400 });
      const existing = await prisma.subscription.findUnique({ where: { tenantId: id } });
      if (existing) {
        await prisma.subscription.update({ where: { tenantId: id }, data: { plan, status: 'active' } });
      } else {
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await prisma.subscription.create({ data: { tenantId: id, plan, status: 'active', currentPeriodEnd: end } });
      }
    } else if (action === 'suspend') {
      await prisma.tenant.update({ where: { id }, data: { isActive: false } });
    } else if (action === 'reactivate') {
      await prisma.tenant.update({ where: { id }, data: { isActive: true } });
    } else {
      return Response.json({ message: 'Acción no válida' }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: { tenantId: id, userId: staff.id, action: 'updated', resourceType: 'tenant', resourceId: id, changes: { action, plan } },
    }).catch(() => {});

    return Response.json({ ok: true, action });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
