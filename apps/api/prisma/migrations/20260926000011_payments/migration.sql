-- Card payments: provider metadata and paid timestamp.
ALTER TABLE "Payment" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE INDEX "Payment_provider_providerRef_idx" ON "Payment"("provider", "providerRef");
CREATE INDEX "Payment_teamId_createdAt_idx" ON "Payment"("teamId", "createdAt");
