import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
