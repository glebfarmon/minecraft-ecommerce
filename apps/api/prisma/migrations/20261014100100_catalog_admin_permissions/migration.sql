-- The seed runs once in production, so an existing ADMIN role gets the 3b permissions here.
-- Idempotent: running it twice leaves one copy of each permission.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['catalog.write', 'server.rcon']::text[]) AS p
  ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
