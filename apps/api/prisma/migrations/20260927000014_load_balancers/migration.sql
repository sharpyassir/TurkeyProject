-- Managed load balancers: HAProxy nodes we run for the customer, a VIP, targets and certificates.
ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'load_balancer';
CREATE TYPE "LoadBalancerStatus" AS ENUM ('creating', 'active', 'updating', 'failed', 'deleting', 'deleted');
CREATE TYPE "LbAlgorithm" AS ENUM ('round_robin', 'least_conn');
CREATE TYPE "CertificateType" AS ENUM ('custom', 'letsencrypt');

ALTER TABLE "Server" ADD COLUMN "managedBy" TEXT;
CREATE INDEX "Server_managedBy_idx" ON "Server"("managedBy");

CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certPem" TEXT,
    "keyPem" TEXT,
    "notAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Certificate_projectId_idx" ON "Certificate"("projectId");
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LoadBalancer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LoadBalancerStatus" NOT NULL DEFAULT 'creating',
    "statusMessage" TEXT,
    "algorithm" "LbAlgorithm" NOT NULL DEFAULT 'round_robin',
    "nodes" INTEGER NOT NULL DEFAULT 1,
    "forwardingRules" JSONB NOT NULL,
    "healthCheck" JSONB NOT NULL,
    "stickySessions" JSONB,
    "redirectHttpToHttps" BOOLEAN NOT NULL DEFAULT false,
    "proxyProtocol" BOOLEAN NOT NULL DEFAULT false,
    "tag" TEXT,
    "publicIpId" TEXT,
    "firewallId" TEXT,
    "vmSecret" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "meteredSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LoadBalancer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoadBalancer_publicIpId_key" ON "LoadBalancer"("publicIpId");
CREATE INDEX "LoadBalancer_projectId_idx" ON "LoadBalancer"("projectId");
ALTER TABLE "LoadBalancer" ADD CONSTRAINT "LoadBalancer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoadBalancer" ADD CONSTRAINT "LoadBalancer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoadBalancer" ADD CONSTRAINT "LoadBalancer_publicIpId_fkey" FOREIGN KEY ("publicIpId") REFERENCES "PublicIp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LoadBalancerNode" (
    "id" TEXT NOT NULL,
    "loadBalancerId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "appliedVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "LoadBalancerNode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoadBalancerNode_serverId_key" ON "LoadBalancerNode"("serverId");
ALTER TABLE "LoadBalancerNode" ADD CONSTRAINT "LoadBalancerNode_loadBalancerId_fkey" FOREIGN KEY ("loadBalancerId") REFERENCES "LoadBalancer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoadBalancerNode" ADD CONSTRAINT "LoadBalancerNode_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LoadBalancerTarget" (
    "id" TEXT NOT NULL,
    "loadBalancerId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "healthy" BOOLEAN,
    "lastCheckedAt" TIMESTAMP(3),
    CONSTRAINT "LoadBalancerTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoadBalancerTarget_loadBalancerId_serverId_key" ON "LoadBalancerTarget"("loadBalancerId", "serverId");
ALTER TABLE "LoadBalancerTarget" ADD CONSTRAINT "LoadBalancerTarget_loadBalancerId_fkey" FOREIGN KEY ("loadBalancerId") REFERENCES "LoadBalancer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoadBalancerTarget" ADD CONSTRAINT "LoadBalancerTarget_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
