-- AlterEnum
ALTER TYPE "DeliveryKind" ADD VALUE 'RESTORE';

-- AlterEnum
ALTER TYPE "DeliveryStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN "refundRevoke" BOOLEAN,
ADD COLUMN "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_stripePaymentIntentId_idx" ON "orders"("stripePaymentIntentId");
