import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.automation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
  }

  create(tenantId: string, data: any) {
    return this.prisma.automation.create({
      data: {
        tenantId,
        name: data.name,
        trigger: data.trigger,
        action: data.action,
        config: data.config || {},
        status: data.status || 'active',
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) return null;
    return this.prisma.automation.update({
      where: { id },
      data: { name: data.name, status: data.status, config: data.config, trigger: data.trigger, action: data.action },
    });
  }

  async remove(tenantId: string, id: string) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) return { ok: false };
    await this.prisma.automation.delete({ where: { id } });
    return { ok: true };
  }

  async run(tenantId: string, id: string) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) return { ok: false, error: 'No encontrada' };

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
