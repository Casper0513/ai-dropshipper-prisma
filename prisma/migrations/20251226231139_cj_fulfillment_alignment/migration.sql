-- AlterEnum
ALTER TYPE "Supplier" ADD VALUE IF NOT EXISTS'manual';

-- DropIndex
ALTER TABLE "FulfillmentOrder"
DROP CONSTRAINT IF EXISTS "FulfillmentOrder_shopifyOrderId_key";

-- AlterTable
ALTER TABLE "FulfillmentOrder"
ADD COLUMN IF NOT EXISTS "metaJson" TEXT,
ADD COLUMN IF NOT EXISTS "shopifyFulfillmentSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "shopifySku" TEXT;

-- CreateIndex
CREATE INDEX "FulfillmentOrder_shopifyOrderId_idx" ON "FulfillmentOrder"("shopifyOrderId");
