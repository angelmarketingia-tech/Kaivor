import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const UPDATE_FIELDS = [
  'status', 'professional', 'notes', 'customerName',
  'customerPhone', 'serviceName',
] as const;

const APPOINTMENT_STATUSES = [
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show',
] as const;

function parseDuration(value: any): number {
  const durationMin = Number(value);
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440) {
    throw new BadRequestException('La duracion debe ser un entero entre 1 y 1440 minutos');
  }
  return durationMin;
}

function pickUpdate(data: any) {
  const out: any = {};
  for (const k of UPDATE_FIELDS) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, from?: string, to?: string, professional?: string) {
    const fromDate = from ? new Date(from) : startOfDay(new Date());
    const toDate = to
      ? new Date(to)
      : (() => {
          const d = startOfDay(new Date());
          d.setDate(d.getDate() + 7);
          return endOfDay(d);
        })();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Rango de fechas invalido');
    }

    const where: any = {
      tenantId,
      startAt: { gte: fromDate, lte: toDate },
    };
    if (professional) where.professional = professional;

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
    });
  }

  async day(tenantId: string, date?: string) {
    const base = date ? new Date(date) : new Date();
    if (isNaN(base.getTime())) throw new BadRequestException('Fecha invalida');

    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: startOfDay(base), lte: endOfDay(base) },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  private async assertNoOverlap(
    tenantId: string,
    professional: string,
    startAt: Date,
    durationMin: number,
    excludeId?: string,
  ) {
    const endAt = new Date(startAt.getTime() + durationMin * 60000);

    const where: any = {
      tenantId,
      professional,
      status: { notIn: ['cancelled', 'no_show'] },
    };
    if (excludeId) where.id = { not: excludeId };

    const candidates = await this.prisma.appointment.findMany({ where });

    const overlaps = candidates.some((appt) => {
      const apptStart = new Date(appt.startAt).getTime();
      const apptEnd = apptStart + (appt.durationMin ?? 0) * 60000;
      // intervals [startAt, endAt) and [apptStart, apptEnd) overlap
      return apptStart < endAt.getTime() && startAt.getTime() < apptEnd;
    });

    if (overlaps) {
      throw new ConflictException('Ese profesional ya tiene una cita en ese horario.');
    }
  }

  async create(tenantId: string, data: any) {
    const customerName = typeof data.customerName === 'string' ? data.customerName.trim() : '';
    if (!customerName) throw new BadRequestException('El nombre del cliente es requerido');

    const serviceName = typeof data.serviceName === 'string' ? data.serviceName.trim() : '';
    if (!serviceName) throw new BadRequestException('El servicio es requerido');

    if (!data.startAt) throw new BadRequestException('La fecha y hora son requeridas');
    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime())) throw new BadRequestException('Fecha y hora invalidas');

    if (startAt.getTime() < Date.now() - 5 * 60000) {
      throw new BadRequestException('No se puede agendar una cita en el pasado');
    }

    const durationMin = data.durationMin !== undefined ? parseDuration(data.durationMin) : 30;

    const customerId = data.customerId ?? null;
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, tenantId },
      });
      if (!customer) throw new BadRequestException('Cliente no encontrado');
    }

    const productId = data.productId ?? null;
    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, tenantId },
      });
      if (!product) throw new BadRequestException('Producto no encontrado');
    }

    const professional = data.professional ?? null;
    if (professional) {
      await this.assertNoOverlap(tenantId, professional, startAt, durationMin);
    }

    return this.prisma.appointment.create({
      data: {
        tenantId,
        customerName,
        customerPhone: data.customerPhone ?? null,
        customerId,
        professional,
        serviceName,
        productId,
        startAt,
        durationMin,
        notes: data.notes ?? null,
        status: 'scheduled',
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Cita no encontrada');

    const fields = pickUpdate(data);

    if (data.status !== undefined && !APPOINTMENT_STATUSES.includes(data.status)) {
      throw new BadRequestException('Estado de cita invalido');
    }

    if (data.startAt !== undefined) {
      const startAt = new Date(data.startAt);
      if (isNaN(startAt.getTime())) throw new BadRequestException('Fecha y hora invalidas');
      fields.startAt = startAt;
    }

    if (data.durationMin !== undefined) {
      fields.durationMin = parseDuration(data.durationMin);
    }

    // Re-check overlap when timing or professional changes
    const startChanged = fields.startAt !== undefined;
    const durationChanged = fields.durationMin !== undefined;
    const professionalChanged = data.professional !== undefined;
    if (startChanged || durationChanged || professionalChanged) {
      const professional =
        fields.professional !== undefined ? fields.professional : existing.professional;
      if (professional) {
        const startAt = startChanged ? fields.startAt : new Date(existing.startAt);
        const durationMin = durationChanged ? fields.durationMin : existing.durationMin;
        await this.assertNoOverlap(tenantId, professional, startAt, durationMin, id);
      }
    }

    return this.prisma.appointment.update({ where: { id }, data: fields });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Cita no encontrada');
    await this.prisma.appointment.delete({ where: { id } });
    return { ok: true };
  }

  async availability(tenantId: string, professional?: string, date?: string) {
    const base = date ? new Date(date) : new Date();
    if (isNaN(base.getTime())) throw new BadRequestException('Fecha invalida');

    const where: any = {
      tenantId,
      startAt: { gte: startOfDay(base), lte: endOfDay(base) },
      status: { notIn: ['cancelled', 'no_show'] },
    };
    if (professional) where.professional = professional;

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      select: {
        startAt: true,
        durationMin: true,
        serviceName: true,
        customerName: true,
      },
    });

    return appointments;
  }
}
