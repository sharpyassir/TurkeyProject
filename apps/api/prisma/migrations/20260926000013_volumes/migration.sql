-- Block volumes on Ceph RBD, attachable to one server at a time.
CREATE TYPE "VolumeStatus" AS ENUM ('creating', 'available', 'attaching', 'attached', 'detaching', 'resizing', 'deleting', 'failed', 'deleted');
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeGb" INTEGER NOT NULL,
    "status" "VolumeStatus" NOT NULL DEFAULT 'creating',
    "statusMessage" TEXT,
    "serverId" TEXT,
    "device" TEXT,
    "driverRef" TEXT,
    "meteredSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Volume_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Volume_projectId_idx" ON "Volume"("projectId");
CREATE INDEX "Volume_serverId_idx" ON "Volume"("serverId");
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
