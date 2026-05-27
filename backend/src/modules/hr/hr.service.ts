import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  // ── Summary ──
  async summary(tenantId: string) {
    const [employees, vacancies, candidates, periods] = await Promise.all([
      this.prisma.employee.findMany({ where: { tenantId, status: 'active' } }),
      this.prisma.vacancy.count({ where: { tenantId, status: 'open' } }),
      this.prisma.candidate.count({ where: { tenantId } }),
      this.prisma.payrollPeriod.count({ where: { tenantId } }),
    ]);
    const totalSalary = employees.reduce((s, e) => s + (e.salary || 0), 0);
    return {
      employees: employees.length,
      openVacancies: vacancies,
      candidates,
      payrollPeriods: periods,
      monthlyPayroll: totalSalary,
    };
  }

  // ── Employees ──
  listEmployees(tenantId: string) {
    return this.prisma.employee.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  createEmployee(tenantId: string, data: any) {
    return this.prisma.employee.create({
      data: {
        tenantId,
        name: data.name,
        document: data.document || '',
        position: data.position,
        department: data.department,
        email: data.email,
        phone: data.phone,
        salary: parseFloat(data.salary) || 0,
        contractType: data.contractType || 'indefinido',
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    });
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
    const period = await this.prisma.payrollPeriod.create({
      data: {
        tenantId,
        name: data.name,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
      },
    });

    if (data.autoIncludeEmployees) {
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
  listBalances(tenantId: string) {
    return this.prisma.employeeBalance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { name: true } } },
    });
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
    return this.prisma.vacancy.create({
      data: {
        tenantId,
        title: data.title,
        department: data.department,
        location: data.location,
        salaryMin: data.salaryMin ? parseFloat(data.salaryMin) : null,
        salaryMax: data.salaryMax ? parseFloat(data.salaryMax) : null,
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
    if (!v) return null;
    return this.prisma.vacancy.update({ where: { id }, data });
  }

  createCandidate(tenantId: string, data: any) {
    return this.prisma.candidate.create({
      data: {
        tenantId,
        vacancyId: data.vacancyId || null,
        name: data.name,
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
