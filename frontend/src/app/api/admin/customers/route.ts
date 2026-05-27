import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { requirePlatform, adminForbidden } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const staff = await requirePlatform(jwt);
  if (!staff) return adminForbidden();

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // active, inactive
    const where: any = {};
    if (filter === 'active') where.isActive = true;
    if (filter === 'inactive') where.isActive = false;

    const tenants = await prisma.tenant.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
    });

    // Enrich with subscription + counts
    const rows = [];
    for (const t of tenants) {
      const [sub, userCount, invoiceCount] = [
        await prisma.subscription.findUnique({ where: { tenantId: t.id } }),
        await prisma.user.count({ where: { tenantId: t.id } }),
        await prisma.invoice.count({ where: { tenantId: t.id } }),
      ];
      rows.push({
        id: t.id, name: t.name, slug: t.slug, isActive: t.isActive,
        plan: sub?.plan ?? 'FREE', subStatus: sub?.status ?? 'none',
        users: userCount, invoices: invoiceCount, createdAt: t.createdAt,
      });
    }
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
