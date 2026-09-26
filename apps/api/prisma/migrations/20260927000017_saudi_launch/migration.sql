-- Launch market moves to Saudi Arabia: riyal billing, Moyasar payments, region sa1.
ALTER TYPE "Currency" RENAME VALUE 'TRY' TO 'SAR';

UPDATE "Payment" SET "provider" = 'stripe' WHERE "provider" = 'iyzico';
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('moyasar', 'bank_transfer', 'manual');
ALTER TABLE "Payment" ALTER COLUMN "provider" TYPE "PaymentProvider" USING (CASE WHEN "provider"::text IN ('stripe', 'iyzico', 'paytr') THEN 'moyasar' ELSE "provider"::text END)::"PaymentProvider";
DROP TYPE "PaymentProvider_old";

UPDATE "Region" SET "id" = 'sa1', "name" = 'Saudi Arabia 1', "country" = 'SA' WHERE "id" = 'ist1';
UPDATE "Team" SET "country" = 'SA' WHERE "country" = 'TR';
ALTER TABLE "Team" ALTER COLUMN "country" SET DEFAULT 'SA';
UPDATE "Invoice" SET "eInvoiceType" = 'zatca' WHERE "eInvoiceType" IN ('e-fatura', 'e-arsiv');
-- Lira rates make no sense for the riyal: start the SAR history at the peg.
DELETE FROM "FxRate" WHERE "quote" = 'SAR';
INSERT INTO "FxRate" ("id", "base", "quote", "rate", "source", "at") VALUES ('fx_sar_peg', 'USD', 'SAR', 3.75, 'migration:peg', CURRENT_TIMESTAMP);
