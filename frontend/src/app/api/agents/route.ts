import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const AGENTS = [
  { type: 'facturacion', name: 'Agente de Facturación', icon: '🧾', desc: 'Revisa errores, sugiere IVA y te ayuda a emitir facturas.', minPlan: 'FREE' },
  { type: 'configuracion', name: 'Agente de Configuración', icon: '⚙️', desc: 'Te guía para configurar DIAN, WhatsApp, correo y medios de pago.', minPlan: 'FREE' },
  { type: 'migracion', name: 'Agente de Migración', icon: '📥', desc: 'Te ayuda a importar tus datos desde Excel y mapear columnas.', minPlan: 'FREE' },
  { type: 'inventario', name: 'Agente de Inventario', icon: '📦', desc: 'Detecta stock bajo, productos agotados y sugiere reposición.', minPlan: 'PRO_AI' },
  { type: 'crm', name: 'Agente CRM', icon: '👥', desc: 'Detecta clientes inactivos y sugiere seguimiento comercial.', minPlan: 'PRO_AI' },
  { type: 'cobranza', name: 'Agente de Cobranza', icon: '💰', desc: 'Detecta facturas vencidas y prioriza a quién cobrar primero.', minPlan: 'BUSINESS' },
  { type: 'ejecutivo', name: 'Agente Ejecutivo', icon: '📊', desc: 'Resume ventas, inventario, clientes y riesgos del negocio.', minPlan: 'BUSINESS' },
];

const PLAN_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO_AI: 2, BUSINESS: 3, ENTERPRISE: 4 };

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    const rank = PLAN_RANK[plan] ?? 0;
    return Response.json({
      plan,
      agents: AGENTS.map(a => ({ ...a, available: rank >= (PLAN_RANK[a.minPlan] ?? 0) })),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
