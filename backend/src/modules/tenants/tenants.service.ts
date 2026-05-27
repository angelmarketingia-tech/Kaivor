import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async createTenant(data: { slug: string; name: string; plan?: string }) {
    return this.prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        plan: data.plan || 'free',
      },
    });
  }

  async getTenant(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async getTenantBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }
}
