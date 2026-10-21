-- The icon is a property of the category (Ranks → crown), not of each product.
ALTER TABLE "categories" ADD COLUMN "icon" "ProductIcon" NOT NULL DEFAULT 'crown';

-- Backfill: the most common product icon per category. A tie goes to the icon of the lowest-sorted product.
-- Categories without products keep the default.
UPDATE "categories" c
SET "icon" = (
  SELECT p."icon"
  FROM "products" p
  WHERE p."categoryId" = c."id"
  GROUP BY p."icon"
  ORDER BY count(*) DESC, min(p."sort") ASC, p."icon" ASC
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM "products" p WHERE p."categoryId" = c."id");

-- Expand/contract: the previous release still reads "products"."icon" while this one migrates, and after an image
-- rollback it reads it again, so the column stays. New code never reads or writes it; the default keeps rows it
-- creates readable by the previous release. Drop the column in the next release.
ALTER TABLE "products" ALTER COLUMN "icon" DROP NOT NULL;
ALTER TABLE "products" ALTER COLUMN "icon" SET DEFAULT 'crown';
