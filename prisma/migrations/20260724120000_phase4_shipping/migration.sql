-- CreateEnum
CREATE TYPE "ShippingProvider" AS ENUM ('UPS', 'USPS');

-- CreateEnum
CREATE TYPE "DimensionSource" AS ENUM ('SHIPPING', 'UPC', 'DUNNAGE_FALLBACK', 'NONE');

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingQuote" (
    "id" TEXT NOT NULL,
    "customerSkuId" TEXT NOT NULL,
    "carrier" "ShippingProvider" NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "rateAmount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billedWeight" DECIMAL(10,4) NOT NULL,
    "dimensionalWeight" DECIMAL(10,4) NOT NULL,
    "divisorUsed" DECIMAL(10,4) NOT NULL,
    "dimensionSource" "DimensionSource" NOT NULL,
    "quoteExpiresAt" TIMESTAMP(3) NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DunnageConfig" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "dunnagePercent" DECIMAL(10,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DunnageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "ShippingQuote_customerSkuId_isSelected_idx" ON "ShippingQuote"("customerSkuId", "isSelected");

-- CreateIndex
CREATE INDEX "ShippingQuote_customerSkuId_quoteExpiresAt_idx" ON "ShippingQuote"("customerSkuId", "quoteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DunnageConfig_categoryId_key" ON "DunnageConfig"("categoryId");

-- AddForeignKey
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_customerSkuId_fkey" FOREIGN KEY ("customerSkuId") REFERENCES "CustomerSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunnageConfig" ADD CONSTRAINT "DunnageConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
