-- Managed databases: clusters of platform owned nodes (Patroni for Postgres), users, databases, backups.
ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'database';
CREATE TYPE "DbEngine" AS ENUM ('postgres', 'valkey', 'mysql');
CREATE TYPE "DbClusterStatus" AS ENUM ('creating', 'active', 'updating', 'failed', 'deleting', 'deleted');
CREATE TYPE "DbBackupStatus" AS ENUM ('running', 'completed', 'failed');

CREATE TABLE "DbCluster" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" "DbEngine" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DbClusterStatus" NOT NULL DEFAULT 'creating',
    "statusMessage" TEXT,
    "nodes" INTEGER NOT NULL DEFAULT 1,
    "sizeId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "adminUser" TEXT NOT NULL,
    "adminPassword" TEXT NOT NULL,
    "trustedSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicIpId" TEXT,
    "firewallId" TEXT,
    "vmSecret" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "backupBucket" TEXT,
    "backupAccessKey" TEXT,
    "backupSecretKey" TEXT,
    "backupHourUtc" INTEGER NOT NULL DEFAULT 2,
    "meteredSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "DbCluster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DbCluster_publicIpId_key" ON "DbCluster"("publicIpId");
CREATE INDEX "DbCluster_projectId_idx" ON "DbCluster"("projectId");
ALTER TABLE "DbCluster" ADD CONSTRAINT "DbCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DbCluster" ADD CONSTRAINT "DbCluster_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DbCluster" ADD CONSTRAINT "DbCluster_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DbCluster" ADD CONSTRAINT "DbCluster_publicIpId_fkey" FOREIGN KEY ("publicIpId") REFERENCES "PublicIp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DbNode" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'unknown',
    "appliedVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "lagBytes" BIGINT,
    CONSTRAINT "DbNode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DbNode_serverId_key" ON "DbNode"("serverId");
ALTER TABLE "DbNode" ADD CONSTRAINT "DbNode_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "DbCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DbNode" ADD CONSTRAINT "DbNode_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DbUser" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DbUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DbUser_clusterId_name_key" ON "DbUser"("clusterId", "name");
ALTER TABLE "DbUser" ADD CONSTRAINT "DbUser_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "DbCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DbDatabase" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DbDatabase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DbDatabase_clusterId_name_key" ON "DbDatabase"("clusterId", "name");
ALTER TABLE "DbDatabase" ADD CONSTRAINT "DbDatabase_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "DbCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DbBackup" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'scheduled',
    "status" "DbBackupStatus" NOT NULL DEFAULT 'running',
    "sizeBytes" BIGINT,
    "label" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    CONSTRAINT "DbBackup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DbBackup_clusterId_idx" ON "DbBackup"("clusterId");
ALTER TABLE "DbBackup" ADD CONSTRAINT "DbBackup_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "DbCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
