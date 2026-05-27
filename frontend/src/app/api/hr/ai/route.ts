import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getTokenFromRequest, unauthorized } from '@/lib/auth';
import { checkHrPlan, hrLocked } from '@/lib/hr';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function POST(req: NextRequest) {
  const jwt = getTokenFromRequest(req);
  if (!jwt) return unauthorized();
  const { plan, allowed } = await checkHrPlan(jwt.tenant_id);
  if (!allowed) return hrLocked(plan);

  try {
    const { question } = await req.json();
    const q = String(question || '').toLowerCase();
    const tid = jwt.tenant_id;

    const employees = await prisma.employee.findMany({ where: { tenantId: tid } });
    if (employees.length === 0 && !/vacante|candidat/.test(q)) {
      return Response.json({ answer: 'No hay datos suficientes todavía. Crea empleados o periodos de nómina para activar este análisis.' });
    }

    let answer = '';

    if (/cuántos empleados|cuantos empleados|total de empleados|número de empleados/.test(q)) {
      const active = employees.filter(e => e.status === 'active').length;
      answer = `Tienes ${employees.length} empleado(s) registrado(s), de los cuales ${active} están activos.`;
    } else if (/activos/.test(q)) {
      const active = employees.filter(e => e.status === 'active');
      answer = `Hay ${active.length} empleado(s) activo(s)${active.length ? ': ' + active.slice(0, 8).map(e => `${e.firstName} ${e.lastName}`).join(', ') : ''}.`;
    } else if (/pendiente.*nómina|pendiente.*nomina|nómina.*pendiente|nomina.*pendiente|falta.*pagar/.test(q)) {
      const periods = await prisma.payrollPeriod.findMany({ where: { tenantId: tid } });
      const unpaid = periods.filter(p => ['approved', 'partially_paid', 'calculated'].includes(p.status));
      const total = unpaid.reduce((s, p) => s + p.totalNet, 0);
      answer = unpaid.length
        ? `Hay ${unpaid.length} periodo(s) de nómina sin pagar por un total de ${fmt(total)}: ${unpaid.map(p => p.name).join(', ')}.`
        : 'No hay nóminas pendientes de pago. Todo está al día.';
    } else if (/planilla|periodo.*nómina|periodo.*nomina|borrador/.test(q)) {
      const periods = await prisma.payrollPeriod.findMany({ where: { tenantId: tid } });
      const drafts = periods.filter(p => p.status === 'draft' || p.status === 'calculated');
      answer = drafts.length
        ? `Hay ${drafts.length} planilla(s) en borrador o sin aprobar: ${drafts.map(p => `${p.name} (${p.status})`).join(', ')}.`
        : 'No hay planillas en borrador.';
    } else if (/saldo/.test(q)) {
      const balances = await prisma.employeeBalance.findMany({
        where: { tenantId: tid, status: 'pending' },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      const total = balances.reduce((s, b) => s + b.amount, 0);
      answer = balances.length
        ? `Hay ${balances.length} saldo(s) pendiente(s) por ${fmt(total)}. Empleados: ${balances.slice(0, 6).map(b => `${b.employee.firstName} ${b.employee.lastName}`).join(', ')}.`
        : 'No hay saldos pendientes con empleados.';
    } else if (/vacante/.test(q)) {
      const vacancies = await prisma.vacancy.findMany({ where: { tenantId: tid } });
      const open = vacancies.filter(v => v.status === 'open');
      answer = open.length
        ? `Hay ${open.length} vacante(s) abierta(s): ${open.map(v => v.title).join(', ')}.`
        : 'No hay vacantes abiertas en este momento.';
    } else if (/entrevista|candidat/.test(q)) {
      const candidates = await prisma.candidate.findMany({ where: { tenantId: tid } });
      const interview = candidates.filter(c => c.stage === 'interview');
      answer = interview.length
        ? `Hay ${interview.length} candidato(s) en etapa de entrevista: ${interview.map(c => `${c.firstName} ${c.lastName}`).join(', ')}.`
        : `No hay candidatos en entrevista. Total de candidatos registrados: ${candidates.length}.`;
    } else if (/última nómina|ultima nomina|cuánto pagamos|cuanto pagamos/.test(q)) {
      const last = await prisma.payrollPeriod.findFirst({
        where: { tenantId: tid, status: 'paid' }, orderBy: { paymentDate: 'desc' },
      });
      answer = last
        ? `La última nómina pagada fue "${last.name}" por ${fmt(last.totalNet)} neto (${fmt(last.totalGross)} bruto).`
        : 'Aún no hay nóminas pagadas.';
    } else if (/ingres.*mes|este mes/.test(q)) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const recent = employees.filter(e => e.startDate && new Date(e.startDate) >= monthStart);
      answer = recent.length
        ? `Este mes ingresaron ${recent.length} empleado(s): ${recent.map(e => `${e.firstName} ${e.lastName}`).join(', ')}.`
        : 'Ningún empleado ingresó este mes.';
    } else if (/área|area|departamento/.test(q)) {
      const counts: Record<string, number> = {};
      for (const e of employees) { const d = e.department || 'Sin área'; counts[d] = (counts[d] ?? 0) + 1; }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      answer = `Distribución por área: ${top.map(([d, c]) => `${d} (${c})`).join(', ')}.`;
    } else if (/contrato.*vence|vence.*contrato/.test(q)) {
      const soon = new Date(Date.now() + 30 * 86400000);
      const expiring = employees.filter(e => e.endDate && new Date(e.endDate) <= soon && new Date(e.endDate) >= new Date());
      answer = expiring.length
        ? `${expiring.length} contrato(s) vencen en los próximos 30 días: ${expiring.map(e => `${e.firstName} ${e.lastName}`).join(', ')}.`
        : 'Ningún contrato vence en los próximos 30 días.';
    } else {
      const active = employees.filter(e => e.status === 'active').length;
      const periods = await prisma.payrollPeriod.count({ where: { tenantId: tid } });
      const openVac = await prisma.vacancy.count({ where: { tenantId: tid, status: 'open' } });
      answer = `Resumen de RRHH: ${employees.length} empleado(s) (${active} activos), ${periods} periodo(s) de nómina, ${openVac} vacante(s) abierta(s). Pregúntame por nómina pendiente, saldos, vacantes o áreas.`;
    }

    await prisma.agentConversation.create({
      data: { tenantId: tid, agentType: 'hr', userId: jwt.sub, question: q.slice(0, 300), answer },
    }).catch(() => {});

    return Response.json({ answer });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
