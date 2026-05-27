import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AgentsService } from './agents.service';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('agents')
@UseGuards(AuthGuard('jwt'))
export class AgentsController {
  constructor(private agents: AgentsService, private prisma: PrismaService) {}

  @Get()
  async list(@Request() req: any) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: req.user.tenantId }, select: { plan: true } });
    return this.agents.list(sub?.plan || 'FREE');
  }

  @Post(':type/ask')
  async ask(@Request() req: any, @Param('type') type: string, @Body('question') question: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: req.user.tenantId }, select: { plan: true } });
    return this.agents.ask(req.user.tenantId, type, question, sub?.plan || 'FREE');
  }
}
