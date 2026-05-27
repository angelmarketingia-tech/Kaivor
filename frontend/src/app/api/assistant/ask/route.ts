import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  try {
    const { question } = await req.json();
    const q = String(question || '').toLowerCase();
    const tid = jwt.tenant_id;
    const now = new Date();
    let answer = '';

    if (/cuántos clientes|cuantos clientes|clientes tenemos|total.*clientes/.test(q)) {
      const c = await prisma.customer.count({ where: { tenantId: tid } });
      answer = `Tienes ${c} cliente(s) registrado(s).`;
    } else if (/factura.*vencid|vencid.*factura/.test(q)) {
      const ov = await prisma.invoice.findMany({ where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } } });
      const total = ov.reduce((s, i) => s + i.total, 0);
      answer = ov.length ? `Hay ${ov.length} factura(s) vencida(s) por ${fmt(total)}.` : 'No tienes facturas vencidas.';
    } else if (/falta.*cobrar|por cobrar|cartera/.test(q)) {
      const unpaid = await prisma.invoice.findMany({ where: { tenantId: tid, paymentStatus: { not: 'paid' } } });
      const total = unpaid.reduce((s, i) => s + i.total, 0);
      answer = unpaid.length ? `Tienes ${fmt(total)} por cobrar en ${unpaid.length} factura(s) sin pagar.` : 'Toda tu cartera está al día.';
    } else if (/cuánto.*facturado|cuanto.*facturado|ventas.*mes|facturado este mes/.test(q)) {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      const inv = await prisma.invoice.findMany({ where: { tenantId: tid, createdAt: { gte: ms } } });
      const total = inv.reduce((s, i) => s + i.total, 0);
      answer = `Este mes has facturado ${fmt(total)} en ${inv.length} factura(s).`;
    } else if (/empleado/.test(q)) {
      const e = await prisma.employee.count({ where: { tenantId: tid } });
      const active = await prisma.employee.count({ where: { tenantId: tid, status: 'active' } });
      answer = e > 0 ? `Tienes ${e} empleado(s), ${active} activo(s).` : 'No hay empleados registrados. El módulo de RRHH está disponible en plan Business.';
    } else if (/nómina|nomina/.test(q)) {
      const periods = await prisma.payrollPeriod.findMany({ where: { tenantId: tid } });
      const unpaid = periods.filter(p => ['approved', 'partially_paid', 'calculated'].includes(p.status));
      const total = unpaid.reduce((s, p) => s + p.totalNet, 0);
      answer = unpaid.length ? `Hay ${unpaid.length} periodo(s) de nómina sin pagar por ${fmt(total)}.` : 'No hay nóminas pendientes.';
    } else if (/proveedor/.test(q)) {
      const balances = await prisma.supplierBalance.findMany({
        where: { tenantId: tid, status: 'pending' }, include: { supplier: { select: { name: true } } },
      });
      const total = balances.reduce((s, b) => s + b.amount, 0);
      answer = balances.length
        ? `Debes ${fmt(total)} a proveedores en ${balances.length} saldo(s): ${[...new Set(balances.map(b => b.supplier.name))].slice(0, 5).join(', ')}.`
        : 'No tienes saldos pendientes con proveedores.';
    } else if (/stock|inventario|reponer|agotad/.test(q)) {
      const inv = await prisma.inventory.findMany({ where: { tenantId: tid }, include: { product: { select: { name: true } } } });
      const low = inv.filter(i => Number(i.quantity) <= Number(i.reorderPoint));
      answer = low.length
        ? `${low.length} producto(s) necesitan reposición: ${low.slice(0, 5).map(i => i.product.name).join(', ')}.`
        : (inv.length ? 'Tu inventario está sano, ningún producto bajo el punto de reorden.' : 'Aún no tienes productos con inventario configurado.');
    } else if (/vacante/.test(q)) {
      const open = await prisma.vacancy.count({ where: { tenantId: tid, status: 'open' } });
      answer = `Tienes ${open} vacante(s) abierta(s).`;
    } else if (/qué plan|que plan|mi plan/.test(q)) {
      const sub = await prisma.subscription.findUnique({ where: { tenantId: tid } });
      answer = `Tu plan actual es ${sub?.plan ?? 'FREE'}.`;
    } else if (/no compr|inactiv.*client/.test(q)) {
      const customers = await prisma.customer.findMany({
        where: { tenantId: tid }, include: { invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const inactive = customers.filter(c => {
        const last = c.invoices[0]?.createdAt;
        return last && (now.getTime() - new Date(last).getTime()) / 86400000 > 30;
      });
      answer = inactive.length
        ? `${inactive.length} cliente(s) no compran hace más de 30 días: ${inactive.slice(0, 5).map(c => c.name).join(', ')}.`
        : 'Todos tus clientes han comprado recientemente.';
    } else {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      const [cust, inv, ov] = [
        await prisma.customer.count({ where: { tenantId: tid } }),
        await prisma.invoice.findMany({ where: { tenantId: tid, createdAt: { gte: ms } } }),
        await prisma.invoice.count({ where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } } }),
      ];
      const revenue = inv.reduce((s, i) => s + i.total, 0);
      answer = `Resumen: ${cust} cliente(s), ${fmt(revenue)} facturado este mes en ${inv.length} factura(s)${ov ? `, ${ov} vencida(s)` : ''}. Pregúntame por cartera, empleados, nómina, proveedores, inventario o vacantes.`;
    }

    await prisma.agentConversation.create({
      data: { tenantId: tid, agentType: 'general', userId: jwt.sub, question: q.slice(0, 300), answer },
    }).catch(() => {});

    return Response.json({ answer });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
