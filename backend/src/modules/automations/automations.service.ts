import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.automation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 4 },
        _count: { select: { runs: true } },
      },
    });
    // La UI lee actions[] (plural) y runs[]; el modelo guarda action (singular string).
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      trigger: a.trigger,
      action: a.action,
      actions: a.action ? [a.action] : [],
      config: a.config,
      status: a.status,
      lastRunAt: a.lastRunAt,
      runCount: a._count.runs,
      runs: (a.runs || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        result: r.result ?? null,
        createdAt: r.createdAt,
      })),
      createdAt: a.createdAt,
    }));
  }

  create(tenantId: string, data: any) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('El nombre de la automatización es requerido');
    if (!data?.trigger) throw new BadRequestException('El disparador (trigger) es requerido');
    if (!data?.action) throw new BadRequestException('La acción es requerida');
    return this.prisma.automation.create({
      data: {
        tenantId,
        name,
        trigger: data.trigger,
        action: data.action,
        config: data.config || {},
        status: data.status || 'active',
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Automatización no encontrada');
    // Whitelist: solo actualizar campos provistos.
    const update: any = {};
    for (const k of ['name', 'status', 'config', 'trigger', 'action']) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    return this.prisma.automation.update({ where: { id }, data: update });
  }

  async remove(tenantId: string, id: string) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) return { ok: false };
    await this.prisma.automation.delete({ where: { id } });
    return { ok: true };
  }

  async run(tenantId: string, id: string) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Automatización no encontrada');

    let result: any = {};
    try {
      if (a.trigger === 'low_stock') {
        const inv = await this.prisma.inventory.findMany({ where: { tenantId } });
        const low = inv.filter((i) => Number(i.quantity) <= Number(i.reorderPoint));
        result = { triggered: low.length, type: 'low_stock' };
      } else if (a.trigger === 'overdue_invoice') {
        const overdue = await this.prisma.invoice.count({
          where: { tenantId, status: { in: ['draft', 'sent'] }, dueDate: { lt: new Date() } },
        });
        result = { triggered: overdue, type: 'overdue_invoice' };
      } else {
        result = { triggered: 0, type: a.trigger };
      }
      await this.prisma.automationRun.create({
        data: { tenantId, automationId: a.id, status: 'success', result, triggeredBy: 'manual' },
      });
      await this.prisma.automation.update({ where: { id: a.id }, data: { lastRunAt: new Date() } });
      return { ok: true, result };
    } catch (e: any) {
      await this.prisma.automationRun.create({
        data: { tenantId, automationId: a.id, status: 'error', result: {}, error: e.message, triggeredBy: 'manual' },
      });
      return { ok: false, error: e.message };
    }
  }
}
