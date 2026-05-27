import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// "Accounts" = Companies within a tenant. The tenant is the "group".
@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const [tenant, companies, userCount] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, plan: true } }),
      this.prisma.company.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);
    return {
      group: { name: tenant?.name || 'Mi grupo', plan: tenant?.plan || 'free' },
      accounts: companies.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'company',
        status: 'active',
        memberCount: userCount,
        taxId: c.taxId,
      })),
    };
  }

  create(tenantId: string, data: any) {
    return this.prisma.company.create({
      data: {
        tenantId,
        name: data.name,
        taxId: data.taxId || `ACC-${Date.now()}`,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
      },
    });
  }

  // Switch active company — returns the company; frontend stores it client-side
  async switch(tenantId: string, accountId: string) {
    const company = await this.prisma.company.findFirst({ where: { id: accountId, tenantId } });
    if (!company) return { ok: false, error: 'Cuenta no encontrada' };
    return { ok: true, account: { id: company.id, name: company.name } };
  }

  async get(tenantId: string, id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, tenantId } });
    if (!company) return null;
    const [productCount, customerCount, invoiceCount] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, companyId: id } }),
      this.prisma.customer.count({ where: { tenantId, companyId: id } }),
      this.prisma.invoice.count({ where: { tenantId, companyId: id } }),
    ]);
    return {
      id: company.id,
      name: company.name,
      taxId: company.taxId,
      email: company.email,
      phone: company.phone,
      address: company.address,
      stats: { products: productCount, customers: customerCount, invoices: invoiceCount },
    };
  }
}
