-- Managed Kubernetes: clusters, node pools and nodes.
CREATE TYPE "KubeClusterStatus" AS ENUM ('creating', 'active', 'updating', 'failed', 'deleting', 'deleted');
ALTER TYPE "ResourceType" ADD VALUE 'kubernetes';

CREATE TABLE "KubeCluster" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "KubeClusterStatus" NOT NULL DEFAULT 'creating',
  "statusMessage" TEXT,
  "ha" BOOLEAN NOT NULL DEFAULT false,
  "controlSizeId" TEXT NOT NULL,
  "publicIpId" TEXT,
  "firewallId" TEXT,
  "vmSecret" TEXT NOT NULL,
  "joinToken" TEXT NOT NULL,
  "certKey" TEXT NOT NULL,
  "caHash" TEXT,
  "kubeconfig" TEXT,
  "podCidr" TEXT NOT NULL DEFAULT '10.244.0.0/16',
  "serviceCidr" TEXT NOT NULL DEFAULT '10.96.0.0/12',
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "cloudState" JSONB NOT NULL DEFAULT '{}',
  "meteredSince" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "KubeCluster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KubeCluster_publicIpId_key" ON "KubeCluster"("publicIpId");
CREATE INDEX "KubeCluster_projectId_idx" ON "KubeCluster"("projectId");
ALTER TABLE "KubeCluster" ADD CONSTRAINT "KubeCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KubeCluster" ADD CONSTRAINT "KubeCluster_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KubeCluster" ADD CONSTRAINT "KubeCluster_controlSizeId_fkey" FOREIGN KEY ("controlSizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KubeCluster" ADD CONSTRAINT "KubeCluster_publicIpId_fkey" FOREIGN KEY ("publicIpId") REFERENCES "PublicIp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "KubeNodePool" (
  "id" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sizeId" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "labels" JSONB NOT NULL DEFAULT '{}',
  "taints" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KubeNodePool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KubeNodePool_clusterId_name_key" ON "KubeNodePool"("clusterId", "name");
ALTER TABLE "KubeNodePool" ADD CONSTRAINT "KubeNodePool_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KubeCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KubeNodePool" ADD CONSTRAINT "KubeNodePool_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "KubeNode" (
  "id" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "poolId" TEXT,
  "serverId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "ready" BOOLEAN NOT NULL DEFAULT false,
  "kubeVersion" TEXT,
  "appliedVersion" INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "KubeNode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KubeNode_serverId_key" ON "KubeNode"("serverId");
CREATE INDEX "KubeNode_clusterId_idx" ON "KubeNode"("clusterId");
ALTER TABLE "KubeNode" ADD CONSTRAINT "KubeNode_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KubeCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KubeNode" ADD CONSTRAINT "KubeNode_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "KubeNodePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KubeNode" ADD CONSTRAINT "KubeNode_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
