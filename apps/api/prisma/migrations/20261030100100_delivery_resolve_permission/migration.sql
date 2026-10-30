-- The seed runs once in production, so the existing ADMIN role gets delivery.resolve here. Idempotent.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['delivery.resolve']::text[]) AS p ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
