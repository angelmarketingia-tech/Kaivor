import { prisma } from './db';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export interface RunResult {
  status: 'success' | 'no_match' | 'failed';
  summary: string;
  matchCount: number;
  matches: { ref?: string; label?: string; detail?: string }[];
  error?: string;
}

// Executes one automation against current data, applies side effects, records an AutomationRun.
// Never throws — failures are captured into a 'failed' AutomationRun.
export async function runAutomation(automation: {
  id: string; tenantId: string; trigger: string; actions: any;
}): Promise<RunResult> {
  const tid = automation.tenantId;
  const now = new Date();
  const actions: string[] = Array.isArray(automation.actions) ? automation.actions : [];
  let matches: { ref?: string; label?: string; detail?: string }[] = [];
  let summary = '';
  let customerIds: string[] = [];

  try {
    if (automation.trigger === 'invoice_overdue') {
      const invoices = await prisma.invoice.findMany({
        where: { tenantId: tid, paymentStatus: { not: 'paid' }, dueDate: { lt: now } },
        include: { customer: { select: { id: true, name: true } } },
      });
      matches = invoices.map(i => ({ ref: i.invoiceNumber, label: i.customer?.name, detail: fmt(i.total) }));
      customerIds = [...new Set(invoices.map(i => i.customer?.id).filter(Boolean) as string[])];
      summary = matches.length
        ? `${matches.length} factura(s) vencida(s). Acción: recordatorio de cobro.`
        : 'No hay facturas vencidas.';
    } else if (automation.trigger === 'low_stock') {
      const inv = await prisma.inventory.findMany({
        where: { tenantId: tid }, include: { product: { select: { name: true } } },
      });
      const low = inv.filter(i => Number(i.quantity) <= Number(i.reorderPoint));
      matches = low.map(i => ({ ref: i.product.name, detail: `${Number(i.quantity)} und` }));
      summary = matches.length
        ? `${matches.length} producto(s) con stock bajo. Acción: alerta de reposición.`
        : 'Todo el inventario está por encima del punto de reorden.';
    } else if (automation.trigger === 'customer_inactive') {
      const customers = await prisma.customer.findMany({
        where: { tenantId: tid }, include: { invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const inactive = customers.filter(c => {
        const last = c.invoices[0]?.createdAt;
        return last && (now.getTime() - new Date(last).getTime()) / 86400000 > 30;
      });
      matches = inactive.map(c => ({ ref: c.name }));
      customerIds = inactive.map(c => c.id);
      summary = matches.length
        ? `${matches.length} cliente(s) sin comprar hace +30 días. Acción: seguimiento de recompra.`
        : 'Todos tus clientes han comprado recientemente.';
    } else if (automation.trigger === 'product_expiring') {
      summary = 'El seguimiento de lotes y fechas de vencimiento estará disponible en una próxima versión. Esta automatización aún no detecta vencimientos.';
      matches = [];
    } else if (automation.trigger === 'onboarding_incomplete') {
      const [company, branding, settings, custCount, invCount] = [
        await prisma.company.findFirst({ where: { tenantId: tid } }),
        await prisma.companyBranding.findUnique({ where: { tenantId: tid } }),
        await prisma.tenantSettings.findUnique({ where: { tenantId: tid } }),
        await prisma.customer.count({ where: { tenantId: tid } }),
        await prisma.invoice.count({ where: { tenantId: tid } }),
      ];
      const steps = [
        !!(company?.taxId && !company.taxId.startsWith('TEMP-')),
        !!branding?.logoData, !!settings?.waBusinessPhone, !!settings?.smtpHost,
        custCount > 0, invCount > 0,
      ];
      const done = steps.filter(Boolean).length;
      if (done < steps.length) {
        matches = [{ label: 'Onboarding incompleto', detail: `${done}/${steps.length} pasos` }];
        summary = `Faltan ${steps.length - done} paso(s) de configuración. Acción: recordar completar el onboarding.`;
      } else {
        summary = 'La configuración inicial está completa.';
      }
    } else if (automation.trigger === 'invoice_created') {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = await prisma.invoice.count({ where: { tenantId: tid, createdAt: { gte: ms } } });
      summary = `Disparador por cada factura creada. ${count} factura(s) este mes activarían esta automatización.`;
      matches = [];
    } else {
      summary = 'Disparador no reconocido.';
    }

    // Side effect: create_crm_activity → registra una nota en el CRM de los clientes afectados
    if (actions.includes('create_crm_activity') && customerIds.length) {
      const note = automation.trigger === 'invoice_overdue'
        ? 'Automatización: factura vencida detectada. Gestionar cobro.'
        : 'Automatización: cliente inactivo. Programar seguimiento de recompra.';
      for (const cid of customerIds.slice(0, 25)) {
        await prisma.customerNote.create({
          data: { tenantId: tid, customerId: cid, authorName: 'Automatización Kaivor', body: note },
        }).catch(() => {});
      }
    }

    const status: RunResult['status'] = matches.length > 0 ? 'success' : 'no_match';
    await prisma.automationRun.create({
      data: {
        tenantId: tid, automationId: automation.id, status, summary,
        output: { matchCount: matches.length, matches: matches.slice(0, 50) },
      },
    });
    await prisma.automation.update({
      where: { id: automation.id }, data: { lastRunAt: now, runCount: { increment: 1 } },
    });
    return { status, summary, matchCount: matches.length, matches: matches.slice(0, 50) };
  } catch (err: any) {
    const errMsg = err?.message || 'Error desconocido';
    await prisma.automationRun.create({
      data: { tenantId: tid, automationId: automation.id, status: 'failed', summary: 'La automatización falló al ejecutarse.', error: errMsg },
    }).catch(() => {});
    await prisma.automation.update({
      where: { id: automation.id }, data: { lastRunAt: now, runCount: { increment: 1 } },
    }).catch(() => {});
    return { status: 'failed', summary: 'La automatización falló al ejecutarse.', matchCount: 0, matches: [], error: errMsg };
  }
}
