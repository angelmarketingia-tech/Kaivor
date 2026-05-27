import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  create(tenantId: string, userId: string | undefined, userEmail: string | undefined, data: any) {
    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        userId,
        userEmail,
        subject: data.subject,
        description: data.description,
        priority: data.priority || 'medium',
        category: data.category,
      },
    });
  }
}
