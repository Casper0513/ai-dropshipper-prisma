-- ============================
-- 1. CREATE ENUMS
-- ============================

DO $$ BEGIN
  CREATE TYPE "Supplier" AS ENUM ('amazon', 'aliexpress', 'walmart', 'cj', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FulfillmentStatus" AS ENUM ('pending', 'ordered', 'shipped', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================
-- 2. CAST SyncedVariant.source
-- ============================

ALTER TABLE "SyncedVariant"
ALTER COLUMN "source"
TYPE "Supplier"
USING source::"Supplier";

-- ============================
-- 3. ADD NEW COLUMNS
-- ============================

ALTER TABLE "SyncedVariant"
ADD COLUMN IF NOT EXISTS "shopifyHandle" TEXT,
ADD COLUMN IF NOT EXISTS "cjProductId" TEXT,
ADD COLUMN IF NOT EXISTS "cjVariantId" TEXT,
ADD COLUMN IF NOT EXISTS "fulfillmentStatus" "FulfillmentStatus";

-- ============================
-- 4. CREATE FulfillmentOrder
-- ============================

CREATE TABLE IF NOT EXISTS "FulfillmentOrder" (
  "id" SERIAL PRIMARY KEY,
  "shopifyOrderId" TEXT NOT NULL UNIQUE,
  "shopifyLineItemId" TEXT NOT NULL,
  "supplier" "Supplier" NOT NULL,
  "cjOrderId" TEXT,
  "cjTrackingNumber" TEXT,
  "status" "FulfillmentStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
