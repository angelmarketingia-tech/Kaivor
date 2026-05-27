import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest } from '@/lib/auth';

// Lightweight event tracking. Accepts authenticated calls; never errors the caller.
export async function POST(req: NextRequest) {
  try {
    const jwt = getTokenFromRequest(req);
    const { eventName, path, referrer, metadata } = await req.json();
    if (!eventName) return Response.json({ ok: false }, { status: 200 });
    await prisma.appEvent.create({
      data: {
        eventName: String(eventName).slice(0, 60),
        tenantId: jwt?.tenant_id ?? null,
        userId: jwt?.sub ?? null,
        path: path ? String(path).slice(0, 200) : null,
        referrer: referrer ? String(referrer).slice(0, 200) : null,
        userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
        metadata: metadata ?? undefined,
      },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
