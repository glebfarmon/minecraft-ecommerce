-- The seed runs once in production, so an existing ADMIN role gets content.write here. Idempotent.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['content.write']::text[]) AS p ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
