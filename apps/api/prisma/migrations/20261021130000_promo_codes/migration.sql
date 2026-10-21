-- CreateEnum
CREATE TYPE "PromoKind" AS ENUM ('PERCENT', 'FIXED');
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "promoCodeId" TEXT;
-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "currency" "Currency",
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "promo_code_categories" (
    "promoCodeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "promo_code_categories_pkey" PRIMARY KEY ("promoCodeId","categoryId")
);
-- CreateTable
CREATE TABLE "promo_code_products" (
    "promoCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "promo_code_products_pkey" PRIMARY KEY ("promoCodeId","productId")
);
-- CreateIndex
CREATE INDEX "promo_code_categories_categoryId_idx" ON "promo_code_categories"("categoryId");
-- CreateIndex
CREATE INDEX "promo_code_products_productId_idx" ON "promo_code_products"("productId");
-- CreateIndex
CREATE INDEX "orders_promoCodeId_idx" ON "orders"("promoCodeId");
-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "promo_code_categories" ADD CONSTRAINT "promo_code_categories_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "promo_code_categories" ADD CONSTRAINT "promo_code_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "promo_code_products" ADD CONSTRAINT "promo_code_products_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "promo_code_products" ADD CONSTRAINT "promo_code_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A code is unique among live (not soft-deleted) rows; Prisma cannot declare this without a preview feature.
CREATE UNIQUE INDEX "promo_codes_code_live_key" ON "promo_codes"("code") WHERE "deletedAt" IS NULL;
