-- USD is the base currency for every price; other currencies are converted at the FxRate in force.
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "base" "Currency" NOT NULL DEFAULT 'USD',
    "quote" "Currency" NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FxRate_base_quote_at_idx" ON "FxRate"("base", "quote", "at");
-- Drop the placeholder lira price rows; lira is derived from USD from now on.
DELETE FROM "Price" WHERE "currency" = 'TRY';
