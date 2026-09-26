-- Server metrics (one sample per minute, hourly rollups) and resource alerts.
CREATE TABLE "MetricSample" (
    "serverId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "cpuPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsedMb" INTEGER NOT NULL DEFAULT 0,
    "memoryTotalMb" INTEGER NOT NULL DEFAULT 0,
    "netInBps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netOutBps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskReadBps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskWriteBps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskUsedPercent" DOUBLE PRECISION,
    CONSTRAINT "MetricSample_pkey" PRIMARY KEY ("serverId", "at")
);
CREATE INDEX "MetricSample_at_idx" ON "MetricSample"("at");

CREATE TABLE "MetricHourly" (
    "serverId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "cpuMax" DOUBLE PRECISION NOT NULL,
    "memoryUsedMb" INTEGER NOT NULL,
    "memoryTotalMb" INTEGER NOT NULL,
    "netInBps" DOUBLE PRECISION NOT NULL,
    "netOutBps" DOUBLE PRECISION NOT NULL,
    "diskReadBps" DOUBLE PRECISION NOT NULL,
    "diskWriteBps" DOUBLE PRECISION NOT NULL,
    "samples" INTEGER NOT NULL,
    CONSTRAINT "MetricHourly_pkey" PRIMARY KEY ("serverId", "at")
);

-- Last raw counters per server so rates can be derived from cumulative agent values.
CREATE TABLE "MetricCursor" (
    "serverId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "netInBytes" BIGINT NOT NULL,
    "netOutBytes" BIGINT NOT NULL,
    "diskReadBytes" BIGINT NOT NULL,
    "diskWriteBytes" BIGINT NOT NULL,
    CONSTRAINT "MetricCursor_pkey" PRIMARY KEY ("serverId")
);

CREATE TYPE "AlertMetric" AS ENUM ('cpu', 'memory', 'disk', 'net_in', 'net_out');
CREATE TYPE "AlertComparator" AS ENUM ('above', 'below');

CREATE TABLE "AlertPolicy" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "comparator" "AlertComparator" NOT NULL DEFAULT 'above',
    "threshold" DOUBLE PRECISION NOT NULL,
    "windowMinutes" INTEGER NOT NULL DEFAULT 5,
    "serverIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AlertPolicy_teamId_idx" ON "AlertPolicy"("teamId");
ALTER TABLE "AlertPolicy" ADD CONSTRAINT "AlertPolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlertIncident" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "peakValue" DOUBLE PRECISION NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "AlertIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AlertIncident_teamId_resolvedAt_startedAt_idx" ON "AlertIncident"("teamId", "resolvedAt", "startedAt");
CREATE INDEX "AlertIncident_policyId_serverId_resolvedAt_idx" ON "AlertIncident"("policyId", "serverId", "resolvedAt");
ALTER TABLE "AlertIncident" ADD CONSTRAINT "AlertIncident_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AlertPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hypertable when TimescaleDB is present; plain table otherwise.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('"MetricSample"', 'at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
  END IF;
END $$;
