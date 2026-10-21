-- The seed runs once in production, so the existing ADMIN role gets promo.write here. Idempotent.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['promo.write']::text[]) AS p ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
