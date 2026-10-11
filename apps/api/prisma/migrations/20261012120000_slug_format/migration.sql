-- Not expressible in Prisma schema: slugs fit the web cart cookie (`server:slug:qty`, apps/web cart-cookie.ts)
-- and keep 30 cart lines under 4 KB.
ALTER TABLE "servers" ADD CONSTRAINT "servers_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{1,40}$');
ALTER TABLE "products" ADD CONSTRAINT "products_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{1,40}$');
