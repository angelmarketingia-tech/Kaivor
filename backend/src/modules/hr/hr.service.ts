import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  // ── Summary ──
  async summary(tenantId: string) {
    const [activeEmployees, totalEmployees, openVacancies, candidates, periods, pendingBalances] = await Promise.all([
      this.prisma.employee.findMany({ where: { tenantId, status: 'active' } }),
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.vacancy.count({ where: { tenantId, status: 'open' } }),
      this.prisma.candidate.count({ where: { tenantId } }),
      this.prisma.payrollPeriod.findMany({ where: { tenantId }, select: { status: true, totalNet: true } }),
      this.prisma.employeeBalance.findMany({ where: { tenantId, status: 'pending' }, select: { amount: true } }),
    ]);
    const monthlyPayroll = Math.round(activeEmployees.reduce((s, e) => s + (e.salary || 0), 0));
    const pendingPayroll = Math.round(
      periods.filter((p) => p.status !== 'paid' && p.status !== 'cancelled').reduce((s, p) => s + (p.totalNet || 0), 0),
    );
    const pendingBalancesAmount = Math.round(pendingBalances.reduce((s, b) => s + (b.amount || 0), 0));

    // Shape anidado que la UI consume (data.employees.active, data.payroll.pendingAmount, etc.)
    return {
      employees: { active: activeEmployees.length, total: totalEmployees },
      payroll: { monthly: monthlyPayroll, pendingAmount: pendingPayroll, periods: periods.length },
      balances: { pendingAmount: pendingBalancesAmount, pendingCount: pendingBalances.length },
      vacancies: { open: openVacancies },
      candidates,
      // back-compat plano por si algo más lo lee
      monthlyPayroll,
      openVacancies,
    };
  }

  // ── Employees ──
  // Frontend reads firstName/lastName; the column is a single `name`. Split it.
  private splitName(name: string) {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: name || '', lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  private shapeEmployee(e: any) {
    if (!e) return e;
    const { firstName, lastName } = this.splitName(e.name);
    return { ...e, firstName, lastName, documentNumber: e.document };
  }

  async listEmployees(tenantId: string) {
    const employees = await this.prisma.employee.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return employees.map((e) => this.shapeEmployee(e));
  }

  createEmployee(tenantId: string, data: any) {
    const name = `${(data.firstName || '').trim()} ${(data.lastName || '').trim()}`.trim() || (data.name || '').trim();
    if (!name) throw new BadRequestException('El nombre del empleado es requerido (firstName/lastName)');
    return this.prisma.employee.create({
      data: {
        tenantId,
        name,
        document: data.documentNumber || data.document || '',
        position: data.position || null,
        department: data.department || null,
        email: data.email || null,
        phone: data.phone || null,
        salary: parseFloat(data.salary) || 0,
        contractType: data.contractType || 'indefinido',
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    }).then((e) => this.shapeEmployee(e));
  }

  async getEmployee(tenantId: string, id: string) {
    const e = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!e) return null;
    const recentPayroll = await this.prisma.payrollItem.findMany({
      where: { tenantId, employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { period: { select: { name: true, periodStart: true, periodEnd: true } } },
    });
    const balances = await this.prisma.employeeBalance.findMany({ where: { tenantId, employeeId: id }, orderBy: { createdAt: 'desc' } });
    const pendingBalance = balances
      .filter((b) => b.status === 'pending')
      .reduce((s, b) => s + (b.amount || 0), 0);
    return {
      employee: this.shapeEmployee(e),
      payrollItems: recentPayroll,
      payrollHistory: recentPayroll,
      balances,
      pendingBalance,
    };
  }

  async updateEmployee(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!existing) return null;

    // Whitelist to real Employee columns; map firstName/lastName -> name, documentNumber -> document.
    const update: any = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = this.splitName(existing.name);
      const firstName = data.firstName !== undefined ? data.firstName : current.firstName;
      const lastName = data.lastName !== undefined ? data.lastName : current.lastName;
      update.name = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim();
    } else if (data.name !== undefined) {
      update.name = data.name;
    }
    if (data.documentNumber !== undefined) update.document = data.documentNumber;
    else if (data.document !== undefined) update.document = data.document;
    if (data.position !== undefined) update.position = data.position;
    if (data.department !== undefined) update.department = data.department;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.contractType !== undefined) update.contractType = data.contractType;
    if (data.status !== undefined) update.status = data.status;
    if (data.salary !== undefined) update.salary = parseFloat(data.salary) || 0;
    if (data.startDate !== undefined && data.startDate) update.startDate = new Date(data.startDate);

    const updated = await this.prisma.employee.update({ where: { id }, data: update });
    return this.shapeEmployee(updated);
  }

  async deleteEmployee(tenantId: string, id: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!existing) return { ok: false };
    // Soft delete (set inactive)
    await this.prisma.employee.update({ where: { id }, data: { status: 'inactive' } });
    return { ok: true };
  }

  async getPayrollPeriod(tenantId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: { employee: { select: { id: true, name: true, document: true, position: true, email: true, phone: true } } },
        },
      },
    });
    if (!period) return null;
    return period;
  }

  async listPayrollReceipts(tenantId: string, periodId: string) {
    return this.prisma.payrollReceipt.findMany({
      where: { tenantId, periodId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayrollReceipt(tenantId: string, periodId: string, data: any) {
    // Frontend sends {itemId, channel}. Map itemId->payrollItemId and derive employeeId from the item.
    const payrollItemId = data.payrollItemId || data.itemId;
    const channel = data.channel; // 'email' | 'whatsapp'
    let employeeId = data.employeeId;
    let employee: any = null;
    if (payrollItemId) {
      const item = await this.prisma.payrollItem.findFirst({
        where: { id: payrollItemId, tenantId },
        include: { employee: { select: { id: true, name: true, phone: true, email: true } } },
      });
      if (!item) throw new NotFoundException('Ítem de nómina no encontrado');
      employeeId = item.employeeId;
      employee = item.employee;
    }
    if (!employeeId) throw new BadRequestException('No se pudo determinar el empleado del comprobante');

    await this.prisma.payrollReceipt.create({
      data: {
        tenantId,
        periodId,
        payrollItemId: payrollItemId || null,
        employeeId,
        pdfUrl: data.pdfUrl || null,
        sentEmail: channel === 'email',
        sentWhatsapp: channel === 'whatsapp',
      },
    });

    // For whatsapp, build a wa.me link the frontend opens
    if (channel === 'whatsapp' && employee?.phone) {
      const digits = String(employee.phone).replace(/\D/g, '');
      const formatted = digits.startsWith('57') ? digits : `57${digits}`;
      const msg = encodeURIComponent(`Hola ${employee.name || ''}, te compartimos tu comprobante de nómina.`);
      return { ok: true, waUrl: `https://wa.me/${formatted}?text=${msg}`, message: 'Comprobante listo para enviar por WhatsApp' };
    }
    return { ok: true, message: channel === 'email' ? 'Comprobante enviado por correo' : 'Comprobante registrado' };
  }

  // ── Payroll period actions (calculate/approve/mark-paid/cancel/add-employee/update-item/remove-item) ──
  async updatePayrollPeriod(tenantId: string, id: string, data: any) {
    const period = await this.prisma.payrollPeriod.findFirst({ where: { id, tenantId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    const action = data.action;

    switch (action) {
      case 'calculate': {
        // (Re)compute items for all active employees if none exist yet, then total.
        const existing = await this.prisma.payrollItem.count({ where: { tenantId, periodId: id } });
        if (existing === 0) {
          const employees = await this.prisma.employee.findMany({ where: { tenantId, status: 'active' } });
          for (const e of employees) {
            const base = e.salary;
            const deductions = base * 0.08;
            await this.prisma.payrollItem.create({
              data: { tenantId, periodId: id, employeeId: e.id, baseSalary: base, earnings: base, deductions, netPay: base - deductions },
            });
          }
        }
        return this.recalcPeriod(tenantId, id, 'calculated');
      }
      case 'approve':
        return this.recalcPeriod(tenantId, id, 'approved');
      case 'mark-paid':
        await this.prisma.payrollItem.updateMany({ where: { tenantId, periodId: id }, data: { paymentStatus: 'paid' } });
        return this.recalcPeriod(tenantId, id, 'paid');
      case 'cancel':
        return this.recalcPeriod(tenantId, id, 'cancelled');
      case 'add-employee': {
        if (!data.employeeId) throw new BadRequestException('employeeId es requerido');
        const e = await this.prisma.employee.findFirst({ where: { id: data.employeeId, tenantId } });
        if (!e) throw new NotFoundException('Empleado no encontrado');
        const dup = await this.prisma.payrollItem.findFirst({ where: { tenantId, periodId: id, employeeId: e.id } });
        if (dup) throw new BadRequestException('El empleado ya está en este periodo');
        const deductions = e.salary * 0.08;
        await this.prisma.payrollItem.create({
          data: { tenantId, periodId: id, employeeId: e.id, baseSalary: e.salary, earnings: e.salary, deductions, netPay: e.salary - deductions },
        });
        return this.recalcPeriod(tenantId, id);
      }
      case 'update-item': {
        if (!data.itemId) throw new BadRequestException('itemId es requerido');
        const item = await this.prisma.payrollItem.findFirst({ where: { id: data.itemId, tenantId, periodId: id } });
        if (!item) throw new NotFoundException('Ítem no encontrado');
        const earnings = data.earnings !== undefined ? parseFloat(data.earnings) : item.earnings;
        const deductions = data.deductions !== undefined ? parseFloat(data.deductions) : item.deductions;
        await this.prisma.payrollItem.update({ where: { id: item.id }, data: { earnings, deductions, netPay: earnings - deductions } });
        return this.recalcPeriod(tenantId, id);
      }
      case 'remove-item': {
        if (!data.itemId) throw new BadRequestException('itemId es requerido');
        await this.prisma.payrollItem.deleteMany({ where: { id: data.itemId, tenantId, periodId: id } });
        return this.recalcPeriod(tenantId, id);
      }
      default:
        throw new BadRequestException(`Acción de nómina no reconocida: ${action}`);
    }
  }

  private async recalcPeriod(tenantId: string, id: string, status?: string) {
    const items = await this.prisma.payrollItem.findMany({ where: { tenantId, periodId: id } });
    const totalGross = items.reduce((s, i) => s + (i.earnings || 0), 0);
    const totalDeductions = items.reduce((s, i) => s + (i.deductions || 0), 0);
    const totalNet = items.reduce((s, i) => s + (i.netPay || 0), 0);
    await this.prisma.payrollPeriod.update({
      where: { id },
      data: { totalGross, totalDeductions, totalNet, ...(status ? { status } : {}) },
    });
    return this.getPayrollPeriod(tenantId, id);
  }

  // ── Payroll ──
  listPayroll(tenantId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async createPayroll(tenantId: string, data: any) {
    // Frontend sends startDate/endDate/includeAllActive; alias to the real columns.
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    const start = data.periodStart || data.startDate;
    const end = data.periodEnd || data.endDate;
    if (!name) throw new BadRequestException('El nombre del periodo es requerido');
    if (!start || !end) throw new BadRequestException('Las fechas de inicio y fin son requeridas');
    const includeAll = data.autoIncludeEmployees ?? data.includeAllActive ?? false;

    const period = await this.prisma.payrollPeriod.create({
      data: {
        tenantId,
        name: data.name,
        periodStart: start ? new Date(start) : new Date(),
        periodEnd: end ? new Date(end) : new Date(),
      },
    });

    if (includeAll) {
      const employees = await this.prisma.employee.findMany({ where: { tenantId, status: 'active' } });
      let totalGross = 0, totalDeductions = 0, totalNet = 0;
      for (const e of employees) {
        const base = e.salary;
        const deductions = base * 0.08; // health 4% + pension 4%
        const net = base - deductions;
        await this.prisma.payrollItem.create({
          data: { tenantId, periodId: period.id, employeeId: e.id, baseSalary: base, earnings: base, deductions, netPay: net },
        });
        totalGross += base; totalDeductions += deductions; totalNet += net;
      }
      await this.prisma.payrollPeriod.update({
        where: { id: period.id },
        data: { totalGross, totalDeductions, totalNet, status: 'calculated' },
      });
    }

    return this.prisma.payrollPeriod.findUnique({
      where: { id: period.id },
      include: { items: { include: { employee: { select: { name: true, document: true, position: true } } } } },
    });
  }

  // ── Balances ──
  // Frontend expects {summary:{pendingCount,pendingAmount}, balances:[{...,type,notes,employee:{firstName,lastName}}]}.
  // The EmployeeBalance model stores the type in `concept` and has no notes/dueDate columns,
  // so we encode "type|notes" into concept and split it back out on read.
  private packConcept(type: string, notes?: string) {
    const t = type || 'other';
    return notes ? `${t}|${notes}` : t;
  }
  private unpackConcept(concept: string) {
    const [type, ...rest] = (concept || 'other').split('|');
    return { type: type || 'other', notes: rest.join('|') || null };
  }

  async listBalances(tenantId: string) {
    const rows = await this.prisma.employeeBalance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { name: true } } },
    });
    const balances = rows.map((b) => {
      const { type, notes } = this.unpackConcept(b.concept);
      const { firstName, lastName } = this.splitName(b.employee?.name || '');
      return {
        id: b.id,
        employeeId: b.employeeId,
        employee: { firstName, lastName, name: b.employee?.name || '' },
        type,
        notes,
        amount: b.amount,
        status: b.status,
        createdAt: b.createdAt,
      };
    });
    const pending = balances.filter((b) => b.status === 'pending');
    return {
      summary: {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s, b) => s + (b.amount || 0), 0),
      },
      balances,
    };
  }

  async createBalance(tenantId: string, data: any) {
    if (!data.employeeId) throw new BadRequestException('employeeId es requerido');
    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    const emp = await this.prisma.employee.findFirst({ where: { id: data.employeeId, tenantId } });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    const bal = await this.prisma.employeeBalance.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        concept: this.packConcept(data.type, data.notes),
        amount,
        status: 'pending',
      },
    });
    return { ok: true, id: bal.id };
  }

  async updateBalance(tenantId: string, data: any) {
    const id = data.id || data.balanceId;
    if (!id) throw new BadRequestException('id es requerido');
    const bal = await this.prisma.employeeBalance.findFirst({ where: { id, tenantId } });
    if (!bal) throw new NotFoundException('Saldo no encontrado');
    const status = data.status || 'paid';
    await this.prisma.employeeBalance.update({ where: { id }, data: { status } });
    return { ok: true };
  }

  // ── Vacancies ──
  listVacancies(tenantId: string) {
    return this.prisma.vacancy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { candidates: true } } },
    });
  }

  createVacancy(tenantId: string, data: any) {
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    if (!title) throw new BadRequestException('El título de la vacante es requerido');
    // Aceptar salaryMin/salaryMax directos o un salaryRange "min-max" del formulario.
    let salaryMin = data.salaryMin ? parseFloat(data.salaryMin) : null;
    let salaryMax = data.salaryMax ? parseFloat(data.salaryMax) : null;
    if ((salaryMin === null || salaryMax === null) && typeof data.salaryRange === 'string') {
      const nums = data.salaryRange.replace(/[^\d\-.]/g, '').split('-').map((s: string) => parseFloat(s)).filter((n: number) => !isNaN(n));
      if (nums.length >= 1 && salaryMin === null) salaryMin = nums[0];
      if (nums.length >= 2 && salaryMax === null) salaryMax = nums[1];
    }
    return this.prisma.vacancy.create({
      data: {
        tenantId,
        title,
        department: data.department,
        location: data.location,
        salaryMin,
        salaryMax,
        description: data.description,
        requirements: data.requirements,
      },
    });
  }

  async getVacancy(tenantId: string, id: string) {
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, tenantId } });
    const candidates = await this.prisma.candidate.findMany({ where: { tenantId, vacancyId: id }, orderBy: { createdAt: 'desc' } });
    return { vacancy, candidates };
  }

  async updateVacancy(tenantId: string, id: string, data: any) {
    const v = await this.prisma.vacancy.findFirst({ where: { id, tenantId } });
    if (!v) throw new NotFoundException('Vacante no encontrada');

    switch (data.action) {
      case 'add-candidate': {
        const candName = (data.name || `${(data.firstName || '').trim()} ${(data.lastName || '').trim()}`.trim()).trim();
        if (!candName) throw new BadRequestException('El nombre del candidato es requerido');
        await this.prisma.candidate.create({
          data: {
            tenantId,
            vacancyId: id,
            name: candName,
            email: data.email || null,
            phone: data.phone || null,
            stage: data.stage || 'applied',
            notes: data.notes || null,
          },
        });
        return this.getVacancy(tenantId, id);
      }
      case 'update-candidate': {
        if (!data.candidateId) throw new BadRequestException('candidateId es requerido');
        const cand = await this.prisma.candidate.findFirst({ where: { id: data.candidateId, tenantId, vacancyId: id } });
        if (!cand) throw new NotFoundException('Candidato no encontrado');
        const cu: any = {};
        if (data.stage !== undefined) cu.stage = data.stage;
        if (data.notes !== undefined) cu.notes = data.notes;
        await this.prisma.candidate.update({ where: { id: cand.id }, data: cu });
        return this.getVacancy(tenantId, id);
      }
      case 'update-vacancy':
      default: {
        // Whitelist Vacancy columns (never forward action/candidate fields to Prisma).
        const update: any = {};
        if (data.title !== undefined) update.title = data.title;
        if (data.department !== undefined) update.department = data.department;
        if (data.location !== undefined) update.location = data.location;
        if (data.description !== undefined) update.description = data.description;
        if (data.requirements !== undefined) update.requirements = data.requirements;
        if (data.status !== undefined) update.status = data.status;
        if (data.salaryMin !== undefined) update.salaryMin = data.salaryMin ? parseFloat(data.salaryMin) : null;
        if (data.salaryMax !== undefined) update.salaryMax = data.salaryMax ? parseFloat(data.salaryMax) : null;
        await this.prisma.vacancy.update({ where: { id }, data: update });
        return this.getVacancy(tenantId, id);
      }
    }
  }

  createCandidate(tenantId: string, data: any) {
    const name = (data.name || `${(data.firstName || '').trim()} ${(data.lastName || '').trim()}`.trim()).trim();
    if (!name) throw new BadRequestException('El nombre del candidato es requerido');
    return this.prisma.candidate.create({
      data: {
        tenantId,
        vacancyId: data.vacancyId || null,
        name,
        email: data.email,
        phone: data.phone,
        stage: data.stage || 'applied',
        notes: data.notes,
      },
    });
  }

  // ── HR AI ──
  async ask(tenantId: string, question: string, plan: string) {
    const q = (question || '').toLowerCase();
    const employees = await this.prisma.employee.findMany({ where: { tenantId, status: 'active' } });
    if (q.includes('cuántos empleados') || q.includes('cuantos empleados')) {
      return { answer: `Tienes ${employees.length} empleado(s) activo(s).`, teaser: false };
    }
    if (q.includes('nómina') || q.includes('nomina') || q.includes('pagar')) {
      const total = employees.reduce((s, e) => s + e.salary, 0);
      return { answer: `La nómina mensual estimada es ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)}.`, teaser: false };
    }
    if (q.includes('vacante')) {
      const open = await this.prisma.vacancy.count({ where: { tenantId, status: 'open' } });
      return { answer: `Tienes ${open} vacante(s) abierta(s).`, teaser: false };
    }
    const hasAI = ['PRO_AI', 'BUSINESS', 'ENTERPRISE'].includes(plan);
    return {
      answer: hasAI ? `Tienes ${employees.length} empleados. Pregúntame por nómina, vacantes o saldos.` : 'Las consultas avanzadas de RRHH con IA están en planes superiores.',
      teaser: !hasAI,
    };
  }
}
