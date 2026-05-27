import { prisma } from './db';

const HR_PLANS = ['BUSINESS', 'ENTERPRISE'];

// Returns { plan, allowed }. HR is a Business+ feature.
export async function checkHrPlan(tenantId: string) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  const plan = sub?.plan ?? 'FREE';
  return { plan, allowed: HR_PLANS.includes(plan) };
}

export function hrLocked(plan: string) {
  return Response.json({
    message: 'El módulo de Recursos Humanos está disponible en los planes Business y Enterprise.',
    plan, locked: true,
  }, { status: 403 });
}
