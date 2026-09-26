-- GitHub App installations and app based deployments with build logs.
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "installationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GithubInstallation_installationId_key" ON "GithubInstallation"("installationId");
CREATE INDEX "GithubInstallation_teamId_idx" ON "GithubInstallation"("teamId");
ALTER TABLE "GithubInstallation" ADD CONSTRAINT "GithubInstallation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Deployment" ADD COLUMN "installationId" TEXT;
ALTER TABLE "Deployment" ADD COLUMN "repoFullName" TEXT;
ALTER TABLE "Deployment" ADD COLUMN "buildLog" TEXT;
ALTER TABLE "Deployment" ADD COLUMN "logUpdatedAt" TIMESTAMP(3);
CREATE INDEX "Deployment_repoFullName_branch_idx" ON "Deployment"("repoFullName", "branch");
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
