-- App Platform: customer containers on shared, platform owned hosts.
CREATE TYPE "AppHostStatus" AS ENUM ('provisioning', 'active', 'draining', 'failed');
CREATE TYPE "PlatformAppStatus" AS ENUM ('creating', 'building', 'live', 'failed', 'stopped', 'deleting', 'deleted');
CREATE TYPE "AppDeployStatus" AS ENUM ('queued', 'building', 'live', 'failed');
ALTER TYPE "ResourceType" ADD VALUE 'app_instance';

CREATE TABLE "AppHost" (
  "id" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "status" "AppHostStatus" NOT NULL DEFAULT 'provisioning',
  "capacityMb" INTEGER NOT NULL,
  "vmSecret" TEXT NOT NULL,
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppHost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppHost_serverId_key" ON "AppHost"("serverId");
ALTER TABLE "AppHost" ADD CONSTRAINT "AppHost_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppHost" ADD CONSTRAINT "AppHost_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlatformApp" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "hostId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "PlatformAppStatus" NOT NULL DEFAULT 'creating',
  "statusMessage" TEXT,
  "repoUrl" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'main',
  "repoFullName" TEXT,
  "installationId" TEXT,
  "gitToken" TEXT,
  "port" INTEGER NOT NULL DEFAULT 3000,
  "envVars" JSONB NOT NULL DEFAULT '{}',
  "size" TEXT NOT NULL DEFAULT 'app-xs',
  "instances" INTEGER NOT NULL DEFAULT 1,
  "healthPath" TEXT,
  "customDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastCommit" TEXT,
  "lastDeployAt" TIMESTAMP(3),
  "buildLog" TEXT,
  "meteredSince" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformApp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformApp_slug_key" ON "PlatformApp"("slug");
CREATE INDEX "PlatformApp_projectId_idx" ON "PlatformApp"("projectId");
CREATE INDEX "PlatformApp_repoFullName_branch_idx" ON "PlatformApp"("repoFullName", "branch");
ALTER TABLE "PlatformApp" ADD CONSTRAINT "PlatformApp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformApp" ADD CONSTRAINT "PlatformApp_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformApp" ADD CONSTRAINT "PlatformApp_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "AppHost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformApp" ADD CONSTRAINT "PlatformApp_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AppDeploy" (
  "id" TEXT NOT NULL,
  "appId" TEXT NOT NULL,
  "status" "AppDeployStatus" NOT NULL DEFAULT 'queued',
  "trigger" TEXT NOT NULL,
  "commit" TEXT,
  "log" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AppDeploy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppDeploy_appId_startedAt_idx" ON "AppDeploy"("appId", "startedAt");
ALTER TABLE "AppDeploy" ADD CONSTRAINT "AppDeploy_appId_fkey" FOREIGN KEY ("appId") REFERENCES "PlatformApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
