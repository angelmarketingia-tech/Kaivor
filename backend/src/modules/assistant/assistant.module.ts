import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AssistantService],
  controllers: [AssistantController],
})
export class AssistantModule {}
