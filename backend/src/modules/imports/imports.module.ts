import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ImportsService],
  controllers: [ImportsController],
})
export class ImportsModule {}
