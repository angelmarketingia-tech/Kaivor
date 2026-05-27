import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const PLAN_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO_AI: 2, BUSINESS: 3, ENTERPRISE: 4 };
const MIN_PLAN: Record<string, string> = {
  facturacion: 'FREE', configuracion: 'FREE', migracion: 'FREE',
  inventario: 'PRO_AI', crm: 'PRO_AI', cobranza: 'BUSINESS', ejecutivo: 'BUSINESS',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { type } = await params;
    const { question } = await req.json();
    const tid = jwt.tenant_id;

    if (!MIN_PLAN[type]) return Response.json({ message: 'Agente no válido' }, { status: 404 });

    const sub = await prisma.subscription.findUnique({ where: { tenantId: tid } });
    const plan = sub?.plan ?? 'FREE';
    if ((PLAN_RANK[plan] ?? 0) < (PLAN_RANK[MIN_PLAN[type]] ?? 0)) {
      return Response.json({
        answer: `Este agente está disponible desde el plan ${MIN_PLAN[type]}. Mejora tu plan para activarlo.`,
        teaser: true,
      });
    }

    const now = new Date();
    let answer = '';
    const suggestions: { label: string; action: string }[] = [];

    if (type === 'facturacion') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const invoices = await prisma.invoice.findMany({ where: { tenantId: tid, createdAt: { gte: monthStart } } });
      const total = invoices.reduce((s, i) => s + i.total, 0);
      const noTax = invoices.filter(i => i.taxAmount === 0).length;
      answer = `Este mes has emitido ${invoices.length} factura(s) por ${fmt(total)}. ` +
        (noTax > 0 ? `${noTax} factura(s) no tienen IVA — verifica si corresponde aplicar 19%. ` : 'Todas con IVA correcto. ') +
        'Recuerda que para emisión electrónica DIAN debes completar los datos fiscales de tu empresa.';
      suggestions.push({ label: 'Crear nueva factura', action: '/invoices/create' });
      suggestions.push({ label: 'Configurar datos fiscales', action: '/settings/company' });
    } else if (type === 'configuracion') {
      const company = await prisma.company.findFirst({ where: { tenantId: tid } });
      const branding = await prisma.companyBranding.findUnique({ where: { tenantId: tid } });
      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tid } });
      const pending: string[] = [];
      if (!company?.taxId || company.taxId.startsWith('TEMP-')) pending.push('datos fiscales (NIT)');
      if (!branding?.logoData) pending.push('logo de la empresa');
      if (!settings?.waBusinessPhone) pending.push('WhatsApp');
      if (!settings?.smtpHost) pending.push('correo SMTP');
      answer = pending.length
        ? `Te falta configurar: ${pending.join(', ')}. Completar estos pasos hará que tus facturas se vean profesionales y puedas enviarlas automáticamente.`
        : '¡Excelente! Tu cuenta está completamente configurada: datos fiscales, logo, WhatsApp y correo.';
      suggestions.push({ label: 'Ir a integraciones', action: '/settings/integrations' });
      suggestions.push({ label: 'Diseño de factura', action: '/settings/billing/templates' });
    } else if (type === 'migracion') {
      const custCount = await prisma.customer.count({ where: { tenantId: tid } });
      const prodCount = await prisma.product.count({ where: { tenantId: tid } });
      answer = `Tienes ${custCount} cliente(s) y ${prodCount} producto(s) registrados. ` +
        'Si manejas tus datos en Excel, puedes importarlos en segundos: sube el archivo, KAIROS AI mapea las columnas automáticamente (Nombre→name, NIT→taxId, Precio→price) y confirmas. Soporta .xlsx y .csv.';
      suggestions.push({ label: 'Importar desde Excel', action: '/imports' });
    } else if (type === 'inventario') {
      const inv = await prisma.inventory.findMany({ where: { tenantId: tid }, include: { product: { select: { name: true } } } });
      const low = inv.filter(i => Number(i.quantity) <= Number(i.reorderPoint));
      answer = inv.length === 0
        ? 'Aún no tienes productos con inventario configurado. Configúralo desde el detalle de cada producto para recibir alertas automáticas.'
        : low.length
          ? `Hay ${low.length} producto(s) que necesitan reposición: ${low.slice(0, 5).map(i => i.product.name).join(', ')}. Te recomiendo generar una orden de compra pronto.`
          : `Tu inventario está sano: ${inv.length} producto(s) seguidos, ninguno por debajo del punto de reorden.`;
      suggestions.push({ label: 'Ver inventario', action: '/inventory' });
    } else if (type === 'crm') {
      const customers = await prisma.customer.findMany({
        where: { tenantId: tid }, include: { invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const inactive = customers.filter(c => {
        const last = c.invoices[0]?.createdAt;
        return last && (now.getTime() - new Date(last).getTime()) / 86400000 > 30;
      });
      const noPurchase = customers.filter(c => c.invoices.length === 0);
      answer = `Tienes ${customers.length} cliente(s). ` +
        (inactive.length ? `${inactive.length} llevan más de 30 días sin comprar — buen momento para un mensaje de recompra. ` : '') +
        (noPurchase.length ? `${noPurchase.length} nunca han comprado — envíales una oferta de bienvenida.` : '') +
        (!inactive.length && !noPurchase.length ? 'Toda tu base está activa y comprando.' : '');
      suggestions.push({ label: 'Ver clientes', action: '/customers' });
      suggestions.push({ label: 'Enviar mensajes', action: '/messages' });
    } else if (type === 'cobranza') {
      const overdue = await prisma.invoice.findMany({
        where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } },
        include: { customer: { select: { name: true } } },
        orderBy: { total: 'desc' },
      });
      const totalDue = overdue.reduce((s, i) => s + i.total, 0);
      answer = overdue.length
        ? `Tienes ${overdue.length} factura(s) vencida(s) por ${fmt(totalDue)}. Prioriza cobrar a: ${overdue.slice(0, 3).map(i => `${i.customer?.name} (${fmt(i.total)})`).join(', ')}. Empieza por los montos más altos.`
        : 'No tienes facturas vencidas. Tu cartera está al día.';
      suggestions.push({ label: 'Ver facturas', action: '/invoices' });
    } else if (type === 'ejecutivo') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [invoices, custCount, prodCount, inv] = [
        await prisma.invoice.findMany({ where: { tenantId: tid, createdAt: { gte: monthStart } } }),
        await prisma.customer.count({ where: { tenantId: tid } }),
        await prisma.product.count({ where: { tenantId: tid } }),
        await prisma.inventory.findMany({ where: { tenantId: tid } }),
      ];
      const revenue = invoices.reduce((s, i) => s + i.total, 0);
      const lowStock = inv.filter(i => Number(i.quantity) <= Number(i.reorderPoint)).length;
      const overdue = await prisma.invoice.count({ where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } } });
      answer = `Resumen ejecutivo del mes:\n• Ventas: ${fmt(revenue)} en ${invoices.length} factura(s)\n• Clientes: ${custCount} · Productos: ${prodCount}\n• Riesgos: ${lowStock} producto(s) con stock bajo, ${overdue} factura(s) vencida(s)\n\n` +
        (overdue > 0 ? 'Acción prioritaria: gestionar la cobranza de facturas vencidas. ' : '') +
        (lowStock > 0 ? 'Revisa la reposición de inventario.' : 'Operación estable.');
      suggestions.push({ label: 'Ver dashboard', action: '/dashboard' });
    }

    await prisma.agentConversation.create({
      data: { tenantId: tid, agentType: type, userId: jwt.sub, question: String(question || '').slice(0, 300), answer },
    }).catch(() => {});

    return Response.json({ answer, suggestions, teaser: false });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
