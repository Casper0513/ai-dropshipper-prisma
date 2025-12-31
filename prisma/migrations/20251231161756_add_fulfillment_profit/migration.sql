-- AlterTable
ALTER TABLE "FulfillmentOrder" ADD COLUMN     "costPrice" DOUBLE PRECISION,
ADD COLUMN     "profitAtFulfillment" DOUBLE PRECISION,
ADD COLUMN     "profitRecordedAt" TIMESTAMP(3),
ADD COLUMN     "salePrice" DOUBLE PRECISION;
