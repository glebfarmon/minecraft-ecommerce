-- Optimistic locking for admin edits (catalog-admin spec decision #7).
ALTER TABLE "servers" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "categories" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "products" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Same slug rule as servers and products (20261012120000_slug_format).
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{1,40}$');
