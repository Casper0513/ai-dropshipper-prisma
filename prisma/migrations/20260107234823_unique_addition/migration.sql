/*
  Warnings:

  - A unique constraint covering the columns `[shopifyVariantId]` on the table `SyncedVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SyncedVariant_shopifyVariantId_key" ON "SyncedVariant"("shopifyVariantId");
