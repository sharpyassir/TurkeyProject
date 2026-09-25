-- Backups are metered per server-minute and rated as a percent of the plan price.
ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'backup';
