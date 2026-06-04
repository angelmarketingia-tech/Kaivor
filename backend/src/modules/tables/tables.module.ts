import { Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { InvoicesModule } from '@/modules/invoices/invoices.module';

@Module({
  imports: [PrismaModule, InvoicesModule],
  providers: [TablesService],
  controllers: [TablesController],
})
export class TablesModule {}
