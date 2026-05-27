-- ADMIA v1.5 Migration
-- Adds: Subscription, UsageEvent, Integration, IntegrationCredential,
--        IntegrationLog, IntegrationWebhookEvent, ExternalReference

-- ─── Subscription ─────────────────────────────────────────────────────────────
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");
CREATE INDEX "Subscription_plan_idx" ON "Subscription"("plan");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- ─── UsageEvent ───────────────────────────────────────────────────────────────
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageEvent_tenantId_idx" ON "UsageEvent"("tenantId");
CREATE INDEX "UsageEvent_tenantId_eventType_idx" ON "UsageEvent"("tenantId", "eventType");
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- ─── Integration ──────────────────────────────────────────────────────────────
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storeUrl" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "settings" JSONB,
    "webhookUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");
CREATE INDEX "Integration_tenantId_provider_idx" ON "Integration"("tenantId", "provider");
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- ─── IntegrationCredential ────────────────────────────────────────────────────
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "consumerKeyEncrypted" TEXT,
    "consumerSecretEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationCredential_integrationId_key" ON "IntegrationCredential"("integrationId");
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── IntegrationLog ───────────────────────────────────────────────────────────
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationLog_integrationId_idx" ON "IntegrationLog"("integrationId");
CREATE INDEX "IntegrationLog_level_idx" ON "IntegrationLog"("level");
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── IntegrationWebhookEvent ──────────────────────────────────────────────────
CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationWebhookEvent_integrationId_topic_externalId_key"
    ON "IntegrationWebhookEvent"("integrationId", "topic", "externalId");
CREATE INDEX "IntegrationWebhookEvent_integrationId_idx" ON "IntegrationWebhookEvent"("integrationId");
CREATE INDEX "IntegrationWebhookEvent_processed_idx" ON "IntegrationWebhookEvent"("processed");
ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ExternalReference ────────────────────────────────────────────────────────
CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalReference_tenantId_provider_externalType_externalId_key"
    ON "ExternalReference"("tenantId", "provider", "externalType", "externalId");
CREATE INDEX "ExternalReference_tenantId_idx" ON "ExternalReference"("tenantId");
CREATE INDEX "ExternalReference_internalId_idx" ON "ExternalReference"("internalId");
