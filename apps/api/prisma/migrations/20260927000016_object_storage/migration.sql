-- S3 compatible buckets on Ceph RGW: one RGW user per project, buckets and access keys.
ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'object_storage';
CREATE TYPE "BucketStatus" AS ENUM ('creating', 'active', 'deleting', 'deleted', 'failed');

CREATE TABLE "Bucket" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BucketStatus" NOT NULL DEFAULT 'creating',
    "statusMessage" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "objectCount" INTEGER NOT NULL DEFAULT 0,
    "usageUpdatedAt" TIMESTAMP(3),
    "meteredSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Bucket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bucket_projectId_idx" ON "Bucket"("projectId");
CREATE UNIQUE INDEX "Bucket_name_live_key" ON "Bucket"("name") WHERE "deletedAt" IS NULL;
ALTER TABLE "Bucket" ADD CONSTRAINT "Bucket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bucket" ADD CONSTRAINT "Bucket_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StorageKey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "StorageKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorageKey_accessKey_key" ON "StorageKey"("accessKey");
CREATE INDEX "StorageKey_projectId_idx" ON "StorageKey"("projectId");
ALTER TABLE "StorageKey" ADD CONSTRAINT "StorageKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
