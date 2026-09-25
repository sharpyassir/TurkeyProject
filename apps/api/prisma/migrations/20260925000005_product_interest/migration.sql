-- "Notify me" clicks on roadmap products in the console.
CREATE TABLE "ProductInterest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductInterest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductInterest_teamId_product_key" ON "ProductInterest"("teamId", "product");
CREATE INDEX "ProductInterest_product_idx" ON "ProductInterest"("product");
