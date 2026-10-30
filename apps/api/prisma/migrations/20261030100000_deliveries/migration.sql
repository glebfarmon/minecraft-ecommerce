-- CreateEnum
CREATE TYPE "DeliveryKind" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT,
    "grantId" TEXT,
    "serverId" TEXT NOT NULL,
    "kind" "DeliveryKind" NOT NULL,
    "commands" TEXT[],
    "commandsDone" INTEGER NOT NULL DEFAULT 0,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "responseLog" JSONB NOT NULL DEFAULT '[]',
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "id" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliveries_orderItemId_idx" ON "deliveries"("orderItemId");

-- CreateIndex
CREATE INDEX "deliveries_grantId_idx" ON "deliveries"("grantId");

-- CreateIndex
CREATE INDEX "deliveries_serverId_idx" ON "deliveries"("serverId");

-- CreateIndex
CREATE INDEX "grants_serverId_idx" ON "grants"("serverId");

-- CreateIndex
CREATE INDEX "grants_productId_idx" ON "grants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "grants_nick_serverId_productId_key" ON "grants"("nick", "serverId", "productId");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Prisma cannot declare partial indexes; they are maintained by hand.
-- A grant order item is delivered once.
CREATE UNIQUE INDEX deliveries_one_grant_per_item ON deliveries("orderItemId") WHERE kind = 'GRANT' AND "orderItemId" IS NOT NULL;

-- The worker polls due PENDING deliveries.
CREATE INDEX deliveries_due ON deliveries("nextAttemptAt") WHERE status = 'PENDING';

-- Admin attention list.
CREATE INDEX deliveries_attention ON deliveries(status) WHERE status IN ('FAILED','NEEDS_REVIEW');

-- The expiry sweep looks at live grants that can expire.
CREATE INDEX grants_due ON grants("expiresAt") WHERE "revokedAt" IS NULL AND "expiresAt" IS NOT NULL;
