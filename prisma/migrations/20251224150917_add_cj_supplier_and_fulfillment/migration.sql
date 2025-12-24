/*
  Warnings:

  - Made the column `createdAt` on table `FulfillmentOrder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `FulfillmentOrder` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FulfillmentOrder" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductLog" ADD COLUMN     "profitAtSale" DOUBLE PRECISION;
