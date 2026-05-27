import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { HrModule } from './modules/hr/hr.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ImportsModule } from './modules/imports/imports.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { EventsModule } from './modules/events/events.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    TransactionsModule,
    InvoicesModule,
    InventoryModule,
    SubscriptionsModule,
    IntegrationsModule,
    AiInsightsModule,
    CompaniesModule,
    HrModule,
    MessagesModule,
    SettingsModule,
    AutomationsModule,
    ImportsModule,
    AccountsModule,
    EventsModule,
    AssistantModule,
    AgentsModule,
    OnboardingModule,
    AdminModule,
  ],
})
export class AppModule {}
