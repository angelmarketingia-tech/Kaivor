import { Injectable, BadRequestException } from '@nestjs/common';
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

  async create(
    tenantId: string,
    userId: string | undefined,
    userEmail: string | undefined,
    data: any,
    reporterName?: string,
  ) {
    const subject = typeof data?.subject === 'string' ? data.subject.trim() : '';
    const description =
      (typeof data?.description === 'string' && data.description.trim()) ||
      (typeof data?.message === 'string' && data.message.trim()) ||
      '';
    if (!subject) throw new BadRequestException('El asunto es obligatorio');
    if (!description) throw new BadRequestException('La descripción es obligatoria');

    // The JWT doesn't carry the user's name; look it up so reporterName isn't null.
    let resolvedName = reporterName || data?.reporterName;
    if (!resolvedName && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      resolvedName = user?.name || undefined;
    }
    if (!resolvedName) resolvedName = userEmail || undefined;

    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        userId,
        userEmail,
        reporterName: resolvedName,
        subject,
        description,
        priority: data?.priority || 'medium',
        category: data?.category || undefined,
      },
    });
  }
}
