import { Module } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsController } from './ai-insights.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
})
export class AiInsightsModule {}
