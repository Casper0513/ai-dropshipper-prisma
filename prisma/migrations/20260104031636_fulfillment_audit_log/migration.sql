-- CreateTable
CREATE TABLE "FulfillmentAuditLog" (
    "id" SERIAL NOT NULL,
    "fulfillmentOrderId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentAuditLog_fulfillmentOrderId_idx" ON "FulfillmentAuditLog"("fulfillmentOrderId");

-- AddForeignKey
ALTER TABLE "FulfillmentAuditLog" ADD CONSTRAINT "FulfillmentAuditLog_fulfillmentOrderId_fkey" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "FulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
