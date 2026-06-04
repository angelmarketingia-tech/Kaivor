import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getVertical, VERTICAL_LIST } from '@/common/business-verticals';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getMyCompany(tenantId: string) {
    // Determinista: siempre la empresa principal (la más antigua) del tenant.
    const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (!company) return null;
    // Attach the resolved vertical config so the POS/receipt can adapt without extra calls.
    const vertical = getVertical(company.businessType);
    return { ...company, vertical };
  }

  /** Catálogo de verticales disponibles (para el selector de onboarding/settings). */
  listVerticals() {
    return { verticals: VERTICAL_LIST };
  }

  async updateMyCompany(tenantId: string, data: any) {
    const company = await this.prisma.company.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (!company) return null;
    // Whitelist updatable columns (incl. businessType + businessConfig).
    const update: any = {};
    for (const k of ['name', 'taxId', 'address', 'phone', 'email', 'businessType', 'businessConfig']) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    const updated = await this.prisma.company.update({ where: { id: company.id }, data: update });
    return { ...updated, vertical: getVertical(updated.businessType) };
  }
}
