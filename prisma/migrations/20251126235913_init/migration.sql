-- CreateTable
CREATE TABLE "Run" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "markupPercent" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLog" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "asin" TEXT,
    "title" TEXT NOT NULL,
    "sourcePrice" DOUBLE PRECISION,
    "finalPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shopifyProductId" TEXT,
    "shopifyHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductLog" ADD CONSTRAINT "ProductLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
