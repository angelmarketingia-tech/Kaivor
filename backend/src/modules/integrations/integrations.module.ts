import { Module } from '@nestjs/common';
import { WooCommerceModule } from './woocommerce/woocommerce.module';

@Module({
  imports: [WooCommerceModule],
  exports: [WooCommerceModule],
})
export class IntegrationsModule {}
