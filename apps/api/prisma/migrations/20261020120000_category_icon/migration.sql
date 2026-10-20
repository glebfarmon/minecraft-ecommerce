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

ALTER TABLE "products" DROP COLUMN "icon";
