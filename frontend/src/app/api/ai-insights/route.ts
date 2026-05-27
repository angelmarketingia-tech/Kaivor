import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: jwt.tenant_id } });
    const plan = sub?.plan ?? 'FREE';
    if (!['PRO_AI','BUSINESS','ENTERPRISE'].includes(plan)) {
      return Response.json({ error: 'Plan no incluye Kaivor AI', plan }, { status: 403 });
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [invoiceCount, customerCount] = await Promise.all([
      prisma.invoice.count({ where: { tenantId: jwt.tenant_id, createdAt: { gte: monthStart } } }),
      prisma.customer.count({ where: { tenantId: jwt.tenant_id } }),
    ]);
    return Response.json({
      insights: [
        { id: '1', priority: 'high', category: 'revenue', title: 'Resumen del mes', description: `${invoiceCount} facturas emitidas este mes con ${customerCount} clientes activos.`, impact: 'positivo' },
        { id: '2', priority: 'medium', category: 'customers', title: 'Base de clientes', description: customerCount > 0 ? `Tienes ${customerCount} clientes registrados.` : 'Comienza agregando clientes para obtener insights más detallados.', impact: 'neutro' },
      ],
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
