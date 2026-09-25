-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('owner', 'admin', 'member', 'billing', 'readonly');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'TRY');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'pending_verification', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "HostStatus" AS ENUM ('active', 'draining', 'maintenance', 'down');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('new', 'provisioning', 'active', 'off', 'rebooting', 'resizing', 'rebuilding', 'deleting', 'deleted', 'failed', 'suspended');

-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('distribution', 'marketplace', 'snapshot', 'custom');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('create', 'start', 'stop', 'reboot', 'resize', 'rebuild', 'snapshot', 'delete');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('pending', 'available', 'failed', 'deleted');

-- CreateEnum
CREATE TYPE "IpStatus" AS ENUM ('free', 'reserved', 'assigned');

-- CreateEnum
CREATE TYPE "FirewallDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "FirewallProtocol" AS ENUM ('tcp', 'udp', 'icmp', 'any');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('draft', 'in_review', 'published', 'deprecated');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('server', 'snapshot', 'public_ip', 'bandwidth', 'volume', 'app');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('promo', 'prepaid', 'refund', 'goodwill');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'iyzico', 'paytr', 'bank_transfer', 'manual');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "AbuseKind" AS ENUM ('mining', 'spam', 'scanning', 'ddos_source', 'phishing', 'payment_fraud', 'report');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "phoneVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "country" TEXT NOT NULL DEFAULT 'TR',
    "status" "AccountStatus" NOT NULL DEFAULT 'pending_verification',
    "taxId" TEXT,
    "kycLevel" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'member',

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quotaServers" INTEGER NOT NULL DEFAULT 10,
    "quotaVcpu" INTEGER NOT NULL DEFAULT 32,
    "quotaMemoryMb" INTEGER NOT NULL DEFAULT 65536,
    "quotaPublicIps" INTEGER NOT NULL DEFAULT 10,
    "spendLimitMinor" INTEGER,
    "spendAlertMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SshKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SshKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "spendCapMinor" INTEGER,
    "spentThisMonthMinor" INTEGER NOT NULL DEFAULT 0,
    "requireApprovalFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driver" TEXT NOT NULL DEFAULT 'proxmox',
    "driverRef" TEXT NOT NULL,
    "status" "HostStatus" NOT NULL DEFAULT 'active',
    "totalVcpu" INTEGER NOT NULL,
    "totalMemoryMb" INTEGER NOT NULL,
    "totalDiskGb" INTEGER NOT NULL,
    "usedVcpu" INTEGER NOT NULL DEFAULT 0,
    "usedMemoryMb" INTEGER NOT NULL DEFAULT 0,
    "usedDiskGb" INTEGER NOT NULL DEFAULT 0,
    "overcommitCpu" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "memoryMb" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "transferTb" DOUBLE PRECISION NOT NULL,
    "family" TEXT NOT NULL DEFAULT 'shared',
    "gpuCount" INTEGER NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "regionId" TEXT,
    "kind" "ImageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "distribution" TEXT,
    "version" TEXT,
    "driverRef" TEXT,
    "minDiskGb" INTEGER NOT NULL DEFAULT 10,
    "minMemoryMb" INTEGER NOT NULL DEFAULT 512,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "hostId" TEXT,
    "sizeId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ServerStatus" NOT NULL DEFAULT 'new',
    "statusMessage" TEXT,
    "driverRef" TEXT,
    "vcpu" INTEGER NOT NULL,
    "memoryMb" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "privateIp" TEXT,
    "userData" TEXT,
    "sshKeyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "backupsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "meteredSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerAction" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'queued',
    "workflowId" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "requestedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ServerAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serverId" TEXT,
    "name" TEXT NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'pending',
    "sizeGb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "driverRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpBlock" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "owned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IpBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicIp" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "projectId" TEXT,
    "serverId" TEXT,
    "address" TEXT NOT NULL,
    "status" "IpStatus" NOT NULL DEFAULT 'free',
    "floating" BOOLEAN NOT NULL DEFAULT false,
    "reverseDns" TEXT,
    "assignedAt" TIMESTAMP(3),

    CONSTRAINT "PublicIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firewall" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firewall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallRule" (
    "id" TEXT NOT NULL,
    "firewallId" TEXT NOT NULL,
    "direction" "FirewallDirection" NOT NULL,
    "protocol" "FirewallProtocol" NOT NULL,
    "ports" TEXT,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,

    CONSTRAINT "FirewallRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallServer" (
    "firewallId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "FirewallServer_pkey" PRIMARY KEY ("firewallId","serverId")
);

-- CreateTable
CREATE TABLE "MarketplaceApp" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "iconUrl" TEXT,
    "minSizeId" TEXT NOT NULL,
    "ports" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "variables" JSONB NOT NULL DEFAULT '[]',
    "cloudInit" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL DEFAULT 'pgcloud',
    "vendorRevenueShare" INTEGER NOT NULL DEFAULT 0,
    "priceMonthlyMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "AppStatus" NOT NULL DEFAULT 'draft',
    "repoUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hostId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id","at")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "hourStart" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "priceId" TEXT,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "invoiceId" TEXT,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "sku" TEXT NOT NULL,
    "sizeId" TEXT,
    "currency" "Currency" NOT NULL,
    "monthlyMinor" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hour',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "creditMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "eInvoiceId" TEXT,
    "eInvoiceType" TEXT,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "remainingMinor" INTEGER NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "currency" "Currency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseFlag" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "serverId" TEXT,
    "kind" "AbuseKind" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT,
    "userId" TEXT,
    "tokenId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "request" JSONB,
    "status" INTEGER NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_slug_key" ON "Project"("teamId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "SshKey_fingerprint_key" ON "SshKey"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_hash_key" ON "ApiToken"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Host_name_key" ON "Host"("name");

-- CreateIndex
CREATE INDEX "Server_projectId_status_idx" ON "Server"("projectId", "status");

-- CreateIndex
CREATE INDEX "Server_hostId_idx" ON "Server"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerAction_workflowId_key" ON "ServerAction"("workflowId");

-- CreateIndex
CREATE INDEX "ServerAction_serverId_startedAt_idx" ON "ServerAction"("serverId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IpBlock_cidr_key" ON "IpBlock"("cidr");

-- CreateIndex
CREATE UNIQUE INDEX "PublicIp_address_key" ON "PublicIp"("address");

-- CreateIndex
CREATE INDEX "PublicIp_status_regionId_idx" ON "PublicIp"("status", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceApp_imageId_key" ON "MarketplaceApp"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceApp_slug_key" ON "MarketplaceApp"("slug");

-- CreateIndex
CREATE INDEX "UsageEvent_projectId_at_idx" ON "UsageEvent"("projectId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_resourceType_resourceId_at_key" ON "UsageEvent"("resourceType", "resourceId", "at");

-- CreateIndex
CREATE INDEX "UsageRecord_projectId_hourStart_idx" ON "UsageRecord"("projectId", "hourStart");

-- CreateIndex
CREATE INDEX "UsageRecord_invoiceId_idx" ON "UsageRecord"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_resourceType_resourceId_hourStart_key" ON "UsageRecord"("resourceType", "resourceId", "hourStart");

-- CreateIndex
CREATE INDEX "Price_resourceType_sku_currency_validFrom_idx" ON "Price"("resourceType", "sku", "currency", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "AbuseFlag_teamId_resolvedAt_idx" ON "AbuseFlag"("teamId", "resolvedAt");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_at_idx" ON "AuditLog"("teamId", "at");

-- CreateIndex
CREATE INDEX "WebhookDelivery_deliveredAt_nextAttemptAt_idx" ON "WebhookDelivery"("deliveredAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SshKey" ADD CONSTRAINT "SshKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Host" ADD CONSTRAINT "Host_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAction" ADD CONSTRAINT "ServerAction_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpBlock" ADD CONSTRAINT "IpBlock_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicIp" ADD CONSTRAINT "PublicIp_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicIp" ADD CONSTRAINT "PublicIp_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "IpBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicIp" ADD CONSTRAINT "PublicIp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicIp" ADD CONSTRAINT "PublicIp_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_firewallId_fkey" FOREIGN KEY ("firewallId") REFERENCES "Firewall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallServer" ADD CONSTRAINT "FirewallServer_firewallId_fkey" FOREIGN KEY ("firewallId") REFERENCES "Firewall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallServer" ADD CONSTRAINT "FirewallServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceApp" ADD CONSTRAINT "MarketplaceApp_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseFlag" ADD CONSTRAINT "AbuseFlag_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── TimescaleDB: UsageEvent becomes a hypertable partitioned by `at` ──
-- Prisma's PK (id, at) already includes the partition column as required.
-- Skipped gracefully when the extension is not installed (local dev / CI).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('"UsageEvent"', 'at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
    -- Raw per-minute events are only needed until the hourly roll-up; keep 90 days.
    PERFORM add_retention_policy('"UsageEvent"', INTERVAL '90 days', if_not_exists => TRUE);
  END IF;
END $$;
