-- TimescaleDB for the usage time-series. On a database without the extension (plain
-- Postgres in local dev / CI) this is a no-op and UsageEvent stays a regular table.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'timescaledb not available (%): UsageEvent will be a plain table', SQLERRM;
END $$;
