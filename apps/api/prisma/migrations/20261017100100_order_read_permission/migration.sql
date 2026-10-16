-- The seed runs once in production, so existing ADMIN and SUPPORT roles get order.read here. Idempotent.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['order.read']::text[]) AS p ORDER BY p
)
WHERE "name" IN ('ADMIN', 'SUPPORT') AND "isSystem" = true;
