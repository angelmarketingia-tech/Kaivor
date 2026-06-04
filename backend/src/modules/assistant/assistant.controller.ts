import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AssistantService } from './assistant.service';
import { PrismaService } from '@/prisma/prisma.service';
import { PermissionsGuard, RequirePermissions } from '@/common/permissions.guard';

@Controller('assistant')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@RequirePermissions('ai.use')
export class AssistantController {
  constructor(private assistant: AssistantService, private prisma: PrismaService) {}

  @Post('ask')
  async ask(@Request() req: any, @Body('question') question: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: req.user.tenantId }, select: { plan: true } });
    return this.assistant.ask(req.user.tenantId, question, sub?.plan || 'FREE');
  }
}
