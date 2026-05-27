import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async getCustomers(tenantId: string, companyId?: string) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCustomer(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async createCustomer(tenantId: string, data: any) {
    // Obtener companyId si no viene en el body
    if (!data.companyId) {
      const company = await this.prisma.company.findFirst({ where: { tenantId } });
      if (company) data.companyId = company.id;
    }
    return this.prisma.customer.create({
      data: { ...data, tenantId },
    });
  }

  async updateCustomer(id: string, data: any, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.customer.update({ where: { id }, data });
  }

  async deleteCustomer(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.customer.delete({ where: { id } });
  }
}
