-- Hosted DNS zones and records, published to PowerDNS.
CREATE TYPE "DnsZoneStatus" AS ENUM ('pending', 'active', 'error', 'deleting', 'deleted');
CREATE TYPE "DnsRecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA');

CREATE TABLE "DnsZone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DnsZoneStatus" NOT NULL DEFAULT 'pending',
    "statusMessage" TEXT,
    "serial" INTEGER NOT NULL DEFAULT 1,
    "syncedSerial" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "DnsZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DnsZone_projectId_idx" ON "DnsZone"("projectId");
CREATE UNIQUE INDEX "DnsZone_name_live_key" ON "DnsZone"("name") WHERE "deletedAt" IS NULL;
ALTER TABLE "DnsZone" ADD CONSTRAINT "DnsZone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DnsRecord" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DnsRecordType" NOT NULL,
    "content" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 3600,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DnsRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DnsRecord_zoneId_idx" ON "DnsRecord"("zoneId");
ALTER TABLE "DnsRecord" ADD CONSTRAINT "DnsRecord_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DnsZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reverse DNS: the name to publish and whether it has reached the nameservers.
ALTER TABLE "PublicIp" ADD COLUMN "reverseDnsSynced" BOOLEAN NOT NULL DEFAULT true;
