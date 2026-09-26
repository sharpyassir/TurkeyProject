-- Managed server tier: care agent state on the server and a percent priced resource type.
ALTER TYPE "ResourceType" ADD VALUE 'managed_server';
ALTER TABLE "Server" ADD COLUMN "managed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Server" ADD COLUMN "managedToken" TEXT;
ALTER TABLE "Server" ADD COLUMN "managedReport" JSONB;
ALTER TABLE "Server" ADD COLUMN "managedReportedAt" TIMESTAMP(3);
ALTER TABLE "Server" ADD COLUMN "managedHealth" TEXT;
CREATE UNIQUE INDEX "Server_managedToken_key" ON "Server"("managedToken");
