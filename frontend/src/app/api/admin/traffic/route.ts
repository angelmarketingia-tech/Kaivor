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
    const since = new Date(Date.now() - 30 * 86400000);
    const events = await prisma.appEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }, take: 5000,
    });

    // Events per day
    const perDay: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};
    const referrerCounts: Record<string, number> = {};
    const nameCounts: Record<string, number> = {};
    for (const e of events) {
      const day = e.createdAt.toISOString().slice(0, 10);
      perDay[day] = (perDay[day] ?? 0) + 1;
      nameCounts[e.eventName] = (nameCounts[e.eventName] ?? 0) + 1;
      if (e.path) pathCounts[e.path] = (pathCounts[e.path] ?? 0) + 1;
      if (e.referrer) referrerCounts[e.referrer] = (referrerCounts[e.referrer] ?? 0) + 1;
    }

    const daily = Object.entries(perDay).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([path, count]) => ({ path, count }));
    const topReferrers = Object.entries(referrerCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([referrer, count]) => ({ referrer, count }));

    // Funnel
    const funnel = [
      { step: 'Registros', count: nameCounts['register'] ?? 0 },
      { step: 'Inicios de sesión', count: nameCounts['login'] ?? 0 },
      { step: 'Vio dashboard', count: nameCounts['dashboard_viewed'] ?? 0 },
      { step: 'Creó cliente', count: nameCounts['customer_created'] ?? 0 },
      { step: 'Creó factura', count: nameCounts['invoice_created'] ?? 0 },
      { step: 'Vio precios', count: nameCounts['pricing_viewed'] ?? 0 },
    ];

    return Response.json({
      totalEvents: events.length,
      daily, topPaths, topReferrers,
      eventBreakdown: nameCounts,
      funnel,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
