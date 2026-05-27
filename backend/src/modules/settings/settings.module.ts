import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MessagesModule } from '@/modules/messages/messages.module';

@Module({
  imports: [PrismaModule, MessagesModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
