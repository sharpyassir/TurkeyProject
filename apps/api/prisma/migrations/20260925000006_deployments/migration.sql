-- Git Deploy: a repository deployed onto a server, redeployed on push.
CREATE TYPE "DeployStatus" AS ENUM ('creating', 'deploying', 'live', 'failed');
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "port" INTEGER NOT NULL DEFAULT 3000,
    "webhookSecret" TEXT NOT NULL,
    "vmSecret" TEXT NOT NULL,
    "envVars" JSONB NOT NULL DEFAULT '{}',
    "status" "DeployStatus" NOT NULL DEFAULT 'creating',
    "lastCommit" TEXT,
    "lastDeployAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Deployment_serverId_key" ON "Deployment"("serverId");
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
