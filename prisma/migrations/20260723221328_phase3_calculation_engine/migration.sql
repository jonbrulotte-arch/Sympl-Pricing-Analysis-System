-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BELOW_CRITICAL_MARGIN', 'BELOW_MINIMUM_MARGIN', 'BELOW_WARNING_MARGIN', 'NEGATIVE_PROFIT', 'MISSING_SELLING_PRICE', 'MISSING_PRODUCT_COST', 'DIMENSION_FALLBACK_USED', 'NO_SHIPPING_QUOTE', 'EXPIRED_QUOTE', 'QUOTE_EXPIRING_SOON', 'COST_INCREASED', 'COST_DECREASED', 'PRICE_CHANGE', 'ALLOCATION_CHANGED', 'MARGIN_REQUIREMENT_CHANGED', 'PENDING_REVIEW', 'REVIEW_OVERDUE', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AlertLifecycleStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'SUPPRESSED', 'RESOLVED');

-- CreateTable
CREATE TABLE "CalculationResult" (
    "id" TEXT NOT NULL,
    "customerSkuId" TEXT NOT NULL,
    "contributionMarginPercent" DECIMAL(10,4) NOT NULL,
    "contributionProfit" DECIMAL(19,4) NOT NULL,
    "netRevenue" DECIMAL(19,4) NOT NULL,
    "totalVariableCost" DECIMAL(19,4) NOT NULL,
    "alertStatus" "AlertStatus" NOT NULL,
    "calculationTrace" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedBy" TEXT,

    CONSTRAINT "CalculationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "customerSkuId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertLifecycleStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "suppressedAt" TIMESTAMP(3),
    "suppressedById" TEXT,
    "suppressedReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "fromStatus" "AlertLifecycleStatus",
    "toStatus" "AlertLifecycleStatus" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalculationResult_customerSkuId_calculatedAt_idx" ON "CalculationResult"("customerSkuId", "calculatedAt");

-- CreateIndex
CREATE INDEX "Alert_customerSkuId_status_idx" ON "Alert"("customerSkuId", "status");

-- CreateIndex
CREATE INDEX "Alert_customerSkuId_alertType_status_idx" ON "Alert"("customerSkuId", "alertType", "status");

-- CreateIndex
CREATE INDEX "AlertHistory_alertId_createdAt_idx" ON "AlertHistory"("alertId", "createdAt");

-- AddForeignKey
ALTER TABLE "CalculationResult" ADD CONSTRAINT "CalculationResult_customerSkuId_fkey" FOREIGN KEY ("customerSkuId") REFERENCES "CustomerSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_customerSkuId_fkey" FOREIGN KEY ("customerSkuId") REFERENCES "CustomerSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_suppressedById_fkey" FOREIGN KEY ("suppressedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertHistory" ADD CONSTRAINT "AlertHistory_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertHistory" ADD CONSTRAINT "AlertHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
