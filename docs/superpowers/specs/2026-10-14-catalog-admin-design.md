# Sub-project 3b: Catalog admin

- Date: 2026-10-14
- Status: Draft, awaiting owner review
- Parent spec: `2026-10-01-minecraft-donation-shop-design.md` (roadmap row 3). Sibling: `2026-10-12-admin-access-design.md` (3a). Data model: `2026-10-09-data-catalog-design.md`. This document narrows them as noted.

## 1. Goal

Admins manage the storefront catalog from the admin app: servers, categories, products, prices, translations, game commands and display order. No code change and no seed is needed to change what the shop sells.

**Narrows the 3a roadmap row:** R2 image uploads are dropped from 3b. Products keep their icons (`ProductIcon`); `imageKey` and R2 stay deferred, as in the data-catalog spec.

Success:

- A user with `catalog.write` creates a product, fills both prices and both translations, enables it, and within a minute it appears on the storefront.
- Dragging a product, a category or a server tab in the admin changes the storefront order the same way.
- A product cannot be enabled while it lacks a price or a translation; the admin lists what is missing.
- Two admins editing the same record cannot silently overwrite each other.
- Only a user with `server.rcon` sees or changes a server's RCON address and password, and can test the connection. The password never leaves the API.
- Every catalog endpoint is documented in Swagger (`/api/docs`) with a summary, a description, the permission it needs and an explanation of every response.

## 2. Decisions

| #   | Topic              | Decision                                                                                                                                                                                                                                                    |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Images             | None in 3b. Icons stay; R2 is a later sub-project.                                                                                                                                                                                                          |
| 2   | Delete             | Allowed only while nothing references the record. Otherwise the record can only be disabled. The API answers `409 in_use` with counts.                                                                                                                      |
| 3   | Permissions        | `catalog.write` (everything in the catalog, including order) and `server.rcon` (RCON address, password, connection test). Reading the catalog needs only an admin session. `ADMIN` gets both, `SUPPORT` neither, `OWNER` always all.                        |
| 4   | Storefront latency | Unchanged: the web app caches the catalog for 60 s (`revalidate: 60`). The admin says "Live on the site within a minute" after a save. Instant revalidation would need a Next route handler, which CLAUDE.md forbids.                                       |
| 5   | Drafts             | A new product is created disabled and may be incomplete. Enabling requires both prices (EUR, PLN) and both translations (en, pl). An enabled product must stay complete.                                                                                    |
| 6   | Shape              | REST per entity plus page-per-entity in the admin, the same pattern as `/team`. Writes are small and each one is audited separately.                                                                                                                        |
| 7   | Concurrency        | `version Int` on `Server`, `Category`, `Product`. Every update and delete sends the version it read; a mismatch is `409 stale`. Reorder requests send the full id list; a different set of ids is `409 stale`.                                              |
| 8   | Drag and drop      | `@dnd-kit/sortable` in the admin: mouse, touch and keyboard (select, arrow keys, drop). The new order is saved on drop; a failed save puts the item back and shows the error.                                                                               |
| 9   | Slugs              | A product's `slug` and `serverId`, and a server's `slug`, can change only while the record is disabled: they are in storefront URLs and in the `cart` cookie (`{server, slug}`). Category slugs can change at any time.                                     |
| 10  | RCON password      | AES-256-GCM into the existing `rconPasswordEnc`, key from `RCON_ENCRYPTION_KEY` (32 bytes, base64). Write-only: the API returns `rconPasswordSet: boolean`. Without the key, RCON writes and tests answer `503 rcon_key_missing`; the rest of the API runs. |
| 11  | Commands           | `grantCommands` and `revokeCommands` are lists of lines. The only placeholder is `{nick}`; any other `{…}` is a validation error. Revoke commands run when a `TIMED` grant expires (delivery sub-project); 3b only edits them.                              |
| 12  | Swagger            | Every catalog operation has the tag `Catalog admin`, a `summary`, a `description` (what it does, the permission, the storefront effect) and a description for every response code. Schema fields carry `v.description(...)`.                                |

## 3. Data model (Prisma)

No new tables. Changes:

- `servers`, `categories`, `products`: add `version Int @default(1)`, incremented on every update and reorder of that row.
- Order uses the existing `Server.sort`, `ServerCategory.sort` and `Product.sort` (within a server and a category).
- Migration `catalog_admin_permissions`: appends `catalog.write` and `server.rcon` to the `ADMIN` role's `permissions` if the role exists. The seed runs once in production, so the seed alone cannot update an existing role. `SYSTEM_ROLES` in `@shop/shared` gets the same change for fresh databases.

Integrity rules, enforced by the API (not only the form):

1. An enabled product has both prices and both translations. Enabling an incomplete one, or removing a price or translation from an enabled one, is `400` with the missing fields.
2. A category is created with both names (en, pl).
3. A product's category must be attached to the product's server (`ServerCategory`).
4. Detaching a category from a server is `409 in_use` while that server has products in it.
5. Deleting a category is `409 in_use` while it has products or server attachments; deleting a server is `409 in_use` while it has products. Products have no references yet; when orders arrive (sub-project 4) they add their count to the product's `in_use` check.
6. `sections` is validated by `ProductSectionSchema`, as on read.

## 4. API (`apps/api`, module `catalog-admin`)

All routes are under `/api/admin/catalog`, declared with `@AdminController` (session + TOTP + audit, as in 3a). Reads need an admin session; writes need `catalog.write`; RCON routes need `server.rcon`.

| Method and path                                    | Permission      | Purpose                                                                       |
| -------------------------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `GET /servers`                                     | session         | Servers in display order, with category order and product counts              |
| `GET /servers/:id`                                 | session         | One server; RCON host and port only with `server.rcon`; `rconPasswordSet`     |
| `POST /servers`                                    | `catalog.write` | Create (disabled)                                                             |
| `PATCH /servers/:id`                               | `catalog.write` | Name, slug (decision #9), accent, onAccent, isActive; with `version`          |
| `DELETE /servers/:id`                              | `catalog.write` | Delete if unused; with `version`                                              |
| `PUT /servers/order`                               | `catalog.write` | Full list of server ids in the new order                                      |
| `PUT /servers/:id/categories`                      | `catalog.write` | Attached categories in order (attach, detach, reorder in one list)            |
| `PUT /servers/:id/rcon`                            | `server.rcon`   | Host, port, and a new password or `clearPassword: true`                       |
| `POST /servers/:id/rcon/test`                      | `server.rcon`   | Connect and run `list`; `{ok: true, ms}` or `{ok: false, error}`; 5 s timeout |
| `GET /categories`                                  | session         | All categories with both names, attached servers and product counts           |
| `POST /categories`, `PATCH /:id`, `DELETE /:id`    | `catalog.write` | Create, rename (slug, en, pl), delete if unused                               |
| `GET /products?serverId=&categoryId=`              | session         | Products in display order, with completeness flags                            |
| `GET /products/:id`                                | session         | Everything: fields, prices, translations, sections, commands                  |
| `POST /products`, `PATCH /products/:id`            | `catalog.write` | Whole product in one body; `PATCH` with `version`                             |
| `DELETE /products/:id`                             | `catalog.write` | Delete if unused; with `version`                                              |
| `PUT /servers/:sid/categories/:cid/products/order` | `catalog.write` | Full list of product ids in that server and category, in the new order        |

- RCON client: the `rcon-client` package, behind an `RconClient` interface so tests use a fake RCON server. The test route is rate-limited to 5 per minute per session.
- Request and response schemas live in `@shop/shared` (`catalog-admin.ts`, Valibot) and are validated with the existing `ValibotPipe`.
- Audit: the 3a interceptor records before and after for every write. `rconPasswordEnc` and passwords are replaced by `"[redacted]"` in audit rows.

Errors (existing `{statusCode, message, issues}` shape):

| Code                   | When                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `400`                  | Invalid body, incomplete product on enable, slug change while enabled, unknown placeholder, category not on the server |
| `403`                  | Missing permission                                                                                                     |
| `404`                  | No such record                                                                                                         |
| `409 stale`            | Version mismatch, or the reorder list is not the current set of ids                                                    |
| `409 in_use`           | Delete or detach blocked; `issues` carries the counts                                                                  |
| `503 rcon_key_missing` | `RCON_ENCRYPTION_KEY` not set                                                                                          |

**Swagger (decision #12).** `buildOpenApiDocument()` gains every route above. A unit test fails when a controller route under `/api/admin/catalog` is missing from the document, or when any operation lacks `summary`, `description` or `tags`, or any response lacks a description. `openapi.json` is regenerated and committed; the admin RTK Query client is regenerated from it.

## 5. Admin app (`apps/admin`)

Pages (shadcn/ui from `@shop/ui`, EN, forms per ADR 0006):

| Route                                             | Content                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/catalog`                                        | Server tabs (draggable, "+ server"); the selected server's categories (draggable, "attach category"); in each category, product cards (drag handle, icon, name, EUR price, badges "disabled" / "incomplete", "+ product"). Order matches the storefront.                                                                                                   |
| `/catalog/products/new`, `/catalog/products/[id]` | Main fields (slug, kind, `durationDays` for `TIMED`, icon, mark, server, category, enabled); prices as decimals ("9.99", sent as minor units); EN and PL tabs with name, description and sections (sections and their entries add, remove and drag); grant and revoke commands, one per line, with a `{nick}` hint; a "missing to enable" list at the top. |
| `/catalog/servers/[id]`                           | Name, slug, accent and onAccent with a tab preview, enabled; RCON block (host, port, "password set", replace, clear, Test) only with `server.rcon`.                                                                                                                                                                                                        |
| `/catalog/categories`                             | Categories with en and pl names, the servers using them and product counts; create, rename, delete.                                                                                                                                                                                                                                                        |

- The shell navigation gains "Catalog" for every admin. Edit controls show only with `catalog.write`; the API checks every request anyway.
- `409 stale` shows "This record changed — reload" and keeps the form values. `409 in_use` shows the counts ("3 products use this category — move or delete them first").
- After a save: "Live on the site within a minute".

## 6. Errors and edge cases

1. Two admins drag in the same list: the second save is `409 stale`; the list reloads.
2. An admin disables a product that is in carts: the storefront already drops unknown or inactive lines in `loadCart`.
3. Moving a product to a category not attached to its server: `400`.
4. A product's server is changed while enabled: `400` (decision #9).
5. RCON test against an unreachable host: `{ok: false, error: "timeout"}` after 5 s; not a 5xx.
6. `RCON_ENCRYPTION_KEY` rotates: stored passwords no longer decrypt; the test reports `decrypt_failed` and the admin re-enters the password. Rotation tooling is out of scope.

## 7. Testing

- **Unit (`@shop/shared`):** admin schemas, completeness check, placeholder check, decimal-to-minor conversion.
- **Unit (api):** encryption round trip and tamper detection; audit redaction; Swagger coverage test (decision #12).
- **Integration (Testcontainers):** every endpoint with and without permissions; `409 stale` and `409 in_use`; integrity rules 1–5; reorder writes `sort`; `GET /api/catalog` reflects order and enabled state; RCON set/test against a fake RCON server; the permission migration on an existing `ADMIN` role.
- **Component (admin):** product form (missing list, prices, sections), sortable list (keyboard reorder, rollback on failure).
- **e2e (Playwright):** sign in as owner → create a product → fill it → enable → reorder by keyboard → the storefront shows it in the new position.

## 8. Docs and config

- `.env.example` and the deploy runbook: `RCON_ENCRYPTION_KEY` (`openssl rand -base64 32`).
- CLAUDE.md: catalog writes go through `/api/admin/catalog`; new admin endpoints must be documented in `openapi.ts` (the coverage test enforces it).
- Deploy guide: set `RCON_ENCRYPTION_KEY` on `shop-api` before using RCON.

## 9. Out of scope

Product images and R2; site content (3c); cases (7); promo codes and order permissions (4); the RCON delivery worker and automatic revoke on expiry (delivery sub-project); key rotation for RCON passwords; bulk import or export.
