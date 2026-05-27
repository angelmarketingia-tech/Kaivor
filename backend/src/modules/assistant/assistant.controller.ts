import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AssistantService } from './assistant.service';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('assistant')
@UseGuards(AuthGuard('jwt'))
export class AssistantController {
  constructor(private assistant: AssistantService, private prisma: PrismaService) {}

  @Post('ask')
  async ask(@Request() req: any, @Body('question') question: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: req.user.tenantId }, select: { plan: true } });
    return this.assistant.ask(req.user.tenantId, question, sub?.plan || 'FREE');
  }
}
