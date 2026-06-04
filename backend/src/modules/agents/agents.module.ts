import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AiQuotaService } from '@/common/ai-quota';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AgentsService, AiQuotaService],
  controllers: [AgentsController],
})
export class AgentsModule {}
