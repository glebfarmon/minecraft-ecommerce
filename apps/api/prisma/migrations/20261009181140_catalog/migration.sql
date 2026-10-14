-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'pl');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'PLN');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PERMANENT', 'TIMED', 'CASE');

-- CreateEnum
CREATE TYPE "ProductIcon" AS ENUM ('crown', 'box', 'coins', 'swords', 'pickaxe', 'ticket');

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "onAccent" TEXT NOT NULL,
    "rconHost" TEXT,
    "rconPort" INTEGER,
    "rconPasswordEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "categoryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("categoryId","locale")
);

-- CreateTable
CREATE TABLE "server_categories" (
    "serverId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "server_categories_pkey" PRIMARY KEY ("serverId","categoryId")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "durationDays" INTEGER,
    "mark" TEXT NOT NULL,
    "icon" "ProductIcon" NOT NULL,
    "grantCommands" TEXT[],
    "revokeCommands" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "productId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sections" JSONB NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("productId","locale")
);

-- CreateTable
CREATE TABLE "prices" (
    "productId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("productId","currency")
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_slug_key" ON "servers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "server_categories_categoryId_idx" ON "server_categories"("categoryId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "products_serverId_slug_key" ON "products"("serverId", "slug");

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_categories" ADD CONSTRAINT "server_categories_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_categories" ADD CONSTRAINT "server_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Not expressible in Prisma schema: keep kind and duration consistent, prices positive.
ALTER TABLE "products" ADD CONSTRAINT "products_duration_matches_kind"
  CHECK (("kind" = 'TIMED') = ("durationDays" IS NOT NULL));
ALTER TABLE "prices" ADD CONSTRAINT "prices_amount_positive" CHECK ("amountMinor" > 0);
