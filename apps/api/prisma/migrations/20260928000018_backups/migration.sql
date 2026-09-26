-- Daily backups: snapshots taken by the platform for servers with backups on.
CREATE TYPE "SnapshotKind" AS ENUM ('manual', 'backup');
ALTER TABLE "Snapshot" ADD COLUMN "kind" "SnapshotKind" NOT NULL DEFAULT 'manual';
CREATE INDEX "Snapshot_serverId_kind_idx" ON "Snapshot"("serverId", "kind");
