import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { runAutomation } from '@/lib/automation-runner';

export const maxDuration = 60;

// Scheduled execution of all active automations across every tenant.
// Protected by CRON_SECRET. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  if (!secret) {
    return Response.json({ message: 'CRON_SECRET no configurado en el servidor.' }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}` && !isVercelCron) {
    return Response.json({ message: 'No autorizado.' }, { status: 401 });
  }

  const startedAt = new Date();
  const automations = await prisma.automation.findMany({ where: { status: 'active' } });

  let success = 0, noMatch = 0, failed = 0;
  const results: any[] = [];

  // Run each automation independently — one failure never stops the rest.
  for (const a of automations) {
    try {
      const r = await runAutomation(a);
      if (r.status === 'success') success++;
      else if (r.status === 'no_match') noMatch++;
      else failed++;
      results.push({ id: a.id, name: a.name, trigger: a.trigger, status: r.status, matchCount: r.matchCount });
    } catch (err: any) {
      failed++;
      results.push({ id: a.id, name: a.name, status: 'failed', error: err?.message });
    }
  }

  return Response.json({
    ok: true,
    ranAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    total: automations.length,
    success, noMatch, failed,
    results,
  });
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
