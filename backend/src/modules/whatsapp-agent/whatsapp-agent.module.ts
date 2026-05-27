import { Module } from '@nestjs/common';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappAgentController, WhatsappWebhookController } from './whatsapp-agent.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WhatsappAgentService],
  controllers: [WhatsappAgentController, WhatsappWebhookController],
  exports: [WhatsappAgentService],
})
export class WhatsappAgentModule {}
