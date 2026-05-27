import { Module } from '@nestjs/common';
import { WooCommerceService } from './woocommerce.service';
import { WooCommerceController } from './woocommerce.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [WooCommerceController],
  providers: [WooCommerceService],
  exports: [WooCommerceService],
})
export class WooCommerceModule {}
