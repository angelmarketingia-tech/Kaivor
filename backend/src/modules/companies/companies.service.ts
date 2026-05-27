import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getMyCompany(tenantId: string) {
    return this.prisma.company.findFirst({
      where: { tenantId },
    });
  }

  async updateMyCompany(tenantId: string, data: {
    name?: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) {
    const company = await this.prisma.company.findFirst({ where: { tenantId } });
    if (!company) return null;
    return this.prisma.company.update({
      where: { id: company.id },
      data,
    });
  }
}
