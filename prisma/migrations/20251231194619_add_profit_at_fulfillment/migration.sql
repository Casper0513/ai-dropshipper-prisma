/*
  Warnings:

  - You are about to drop the column `costPrice` on the `FulfillmentOrder` table. All the data in the column will be lost.
  - You are about to drop the column `profitAtFulfillment` on the `FulfillmentOrder` table. All the data in the column will be lost.
  - You are about to drop the column `profitRecordedAt` on the `FulfillmentOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FulfillmentOrder" DROP COLUMN "costPrice",
DROP COLUMN "profitAtFulfillment",
DROP COLUMN "profitRecordedAt",
ADD COLUMN     "profit" DOUBLE PRECISION,
ADD COLUMN     "shippingCost" DOUBLE PRECISION,
ADD COLUMN     "supplierCost" DOUBLE PRECISION;
