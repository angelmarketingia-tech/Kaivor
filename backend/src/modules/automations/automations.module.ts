import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AutomationsService],
  controllers: [AutomationsController],
})
export class AutomationsModule {}
