-- CreateTable
CREATE TABLE "SyncedVariant" (
    "id" SERIAL NOT NULL,
    "asin" TEXT,
    "sku" TEXT,
    "source" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "lastCostPrice" DOUBLE PRECISION,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncedVariant_pkey" PRIMARY KEY ("id")
);
