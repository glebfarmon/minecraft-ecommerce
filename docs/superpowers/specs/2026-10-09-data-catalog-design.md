# Sub-project 2: Data and catalog

- Date: 2026-10-09
- Status: Draft, awaiting owner review
- Parent spec: `2026-10-01-minecraft-donation-shop-design.md` (roadmap row 2). This document narrows and amends it where noted.

## 1. Goal

The storefront shows servers, categories and products from Postgres through the API instead of `apps/web/src/config/products.ts` and `servers.ts`. To a visitor the site looks the same. The demo files become the database seed.

Success:

- `GET /api/catalog?locale=pl` returns the public catalog from the database.
- `web` renders every page from that response; `config/products.ts` and `config/servers.ts` no longer hold catalog data.
- `pnpm build` in CI succeeds with no API or database reachable.
- RCON fields and game commands never appear in any public response.

## 2. Decisions

| #   | Topic                      | Decision                                                                                                                                                                                                 |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Product ownership          | A product belongs to exactly one server (as in the web demo). The same rank on two servers is two products. **Amends parent decision #12 and §6.2** (`product_offerings` is dropped).                    |
| 2   | Category order             | Categories are global (slug + translations); each server has its own ordered list of categories (`server_categories`).                                                                                   |
| 3   | Tables in scope            | Catalog only. Orders, cases, auth/admin and content tables are added by the sub-projects that first read them. **Narrows parent roadmap row 2** ("all tables").                                          |
| 4   | Redis cache                | Not built. `web` caches the API response (Next data cache, 60 s); Postgres serves the rest. **Amends parent §8 item 3.** Can be added later behind `CatalogService` without changing the contract.       |
| 5   | Locale                     | Passed explicitly as `?locale=` (from the page URL), never read from cookies: the response is cacheable by URL and the page's language is unambiguous.                                                   |
| 6   | One endpoint               | The whole public catalog in one response (3 servers, ~20 products): the storefront needs all of it on every page (navbar, cart validation, catalog).                                                     |
| 7   | Contract                   | Valibot schemas in a new `packages/shared` (`@shop/shared`), validated by a `ValibotPipe`, OpenAPI generated from the same schemas, `openapi.json` committed and checked in CI (parent §5 steps 1–3, 5). |
| 8   | Client codegen             | RTK Query codegen (parent §5 step 4) is deferred to the first browser-side API consumer (admin, sub-project 3). `web` reads the catalog on the server and imports types from `@shop/shared`.             |
| 9   | Web data access            | `getCatalog(locale)` on the server (same pattern as `getRules`); a `CatalogProvider` passes it to Client Components, which read it through `useCatalog()`.                                               |
| 10  | Build without API          | Catalog-dependent routes render at request time from cached data; no page fetches the API during `next build`. Verified by a spike as the first task.                                                    |
| 11  | Category and product names | Come from the database (translations with fallback to `en`), not from next-intl messages.                                                                                                                |

## 3. Data model (Prisma)

```prisma
enum Locale { en pl }
enum Currency { EUR PLN }
enum ProductKind { PERMANENT TIMED CASE }
enum ProductIcon { crown box coins swords pickaxe ticket }

model Server {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  accent          String            // CSS colour, e.g. #ff6b1a
  onAccent        String            // text colour on accent
  rconHost        String?
  rconPort        Int?
  rconPasswordEnc String?           // AES-256-GCM, filled by sub-project 3
  isActive        Boolean  @default(true)
  sort            Int      @default(0)
  categories      ServerCategory[]
  products        Product[]
}

model Category {
  id           String                @id @default(cuid())
  slug         String                @unique
  translations CategoryTranslation[]
  servers      ServerCategory[]
  products     Product[]
}

model CategoryTranslation {
  categoryId String
  locale     Locale
  name       String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([categoryId, locale])
}

model ServerCategory {
  serverId   String
  categoryId String
  sort       Int
  server     Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  @@id([serverId, categoryId])
  @@index([categoryId])
}

model Product {
  id             String               @id @default(cuid())
  serverId       String
  categoryId     String
  slug           String
  kind           ProductKind
  durationDays   Int?                 // set iff kind = TIMED
  mark           String               // short wordmark on the tile
  icon           ProductIcon
  grantCommands  String[]
  revokeCommands String[]
  isActive       Boolean              @default(true)
  sort           Int                  @default(0)
  server         Server               @relation(fields: [serverId], references: [id], onDelete: Restrict)
  category       Category             @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  translations   ProductTranslation[]
  prices         Price[]
  @@unique([serverId, slug])
  @@index([categoryId])
}

model ProductTranslation {
  productId   String
  locale      Locale
  name        String
  description String
  sections    Json                    // ProductSection[] (schema in @shop/shared)
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@id([productId, locale])
}

model Price {
  productId   String
  currency    Currency
  amountMinor Int
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@id([productId, currency])
}
```

- `adult` (18+ badge) is not stored: it is `kind = CASE`.
- A check constraint (raw SQL in the migration) enforces `durationDays IS NOT NULL` exactly when `kind = 'TIMED'`, and `amountMinor > 0`.
- `sections` is validated by the `ProductSection[]` schema when seeded and when read; invalid JSON in the database fails the request with 500 and a log entry rather than shipping malformed data.

## 4. API

### 4.1 `GET /api/catalog?locale=en|pl`

Public, no auth. `locale` is required and validated (`400` otherwise). `Cache-Control: public, max-age=0, s-maxage=60` (the web data cache does the real caching).

```ts
type CatalogResponse = {
  servers: {
    slug: string
    name: string
    accent: string
    onAccent: string
    categories: {slug: string; name: string}[] // in this server's order
  }[]
  products: {
    server: string // server slug
    category: string // category slug
    slug: string
    kind: 'PERMANENT' | 'TIMED' | 'CASE'
    durationDays: number | null
    mark: string
    icon: 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'
    name: string
    description: string
    sections: {title: string; entries: {cmd?: string; text?: string; cooldown?: string}[]}[]
    prices: {EUR: number; PLN: number} // minor units
  }[]
}
```

- Only `isActive` servers and products; products of an inactive server are omitted.
- Servers by `sort`, products by `sort` then `slug`.
- Translations: requested locale, falling back to `en` per field set (a product with no `pl` row returns its `en` row).
- A product missing a price in either currency is omitted and logged as `warn` (the storefront cannot sell it).
- Never includes `rconHost`, `rconPort`, `rconPasswordEnc`, `grantCommands`, `revokeCommands`, ids.

### 4.2 Contract plumbing

- `packages/shared` (`@shop/shared`): `LocaleSchema`, `CurrencySchema`, `ProductSectionSchema`, `CatalogQuerySchema`, `CatalogResponseSchema` (Valibot) and their inferred types.
- `ValibotPipe` in `apps/api/src/common/`: validates `@Query()`/`@Body()` against a schema, `400` with Valibot issues on failure.
- OpenAPI: a document built from the schemas with `@valibot/to-json-schema`, served at `/api/docs` (Swagger UI) and written to `apps/api/openapi.json` by a script; CI regenerates and fails on diff.

### 4.3 Health

`/api/health` stays the liveness probe (version). A readiness check for Postgres is added (`/api/health/ready`, `@nestjs/terminus` Prisma check); the Docker `HEALTHCHECK` keeps using liveness so a database blip does not restart the API.

## 5. Database operations

- Prisma in `apps/api/prisma/` (`schema.prisma`, `migrations/`, `seed.ts`), `PrismaService` in `apps/api/src/prisma/`.
- `DATABASE_URL` in `.env.example` (repo root) and in `compose.e2e.yaml` for `api`.
- Migrations: `prisma migrate dev` locally, generated SQL reviewed and committed; never edited after merge (parent §6.5).
- Deploy: a one-off `migrate` service from the API image runs `prisma migrate deploy` before `api` starts (`depends_on: condition: service_completed_successfully`) in `compose.e2e.yaml`; the same service definition is documented for Dokploy.
- Seed: `prisma db seed` loads the current web demo catalog (3 servers, 5 categories, 20 products, EN/PL texts and prices). It is idempotent (upsert by slug). The e2e stack seeds on start.
- CI: `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` fails when schema and migrations disagree.

## 6. Web

- `features/catalog/api/get-catalog.ts`: `getCatalog(locale)` fetches `${API_ORIGIN}/api/catalog?locale=` with `next: {revalidate: 60, tags: ['catalog']}`, parses with `CatalogResponseSchema`, throws on non-2xx (never caches a failure).
- `features/catalog/catalog-provider.tsx`: client context; `useCatalog()` returns `{servers, products, findServer(slug), findProduct(server, slug)}`.
- `app/[locale]/layout.tsx` loads the catalog and wraps the tree in `CatalogProvider`.
- Consumers switch from `@/config/products`, `@/config/servers` and `@/lib/catalog` lookups to `useCatalog()` (Client Components) or `getCatalog()` (Server Components): navbar, footer, home and server pages, catalog, product card/detail/modal/plate/sections/icon, add-to-cart, cart menu, shop provider (saved-cart validation), order summary, live feed.
- `lib/catalog.ts` keeps pure helpers (`productLayoutId`, `productPlateLayoutId`, `formatPrice`) typed against the API product type.
- `config/products.ts` and `config/servers.ts` are deleted; their data moves to `apps/api/prisma/seed-data/`. `defaultServer` becomes "first server in the response".
- Category labels: the `catalog.categories.*` next-intl keys are removed; names come from the API.
- If the catalog request fails and nothing is cached, the page renders a localized "Shop is temporarily unavailable" state instead of a 500; the rules page and legal links still work.
- Build: the spike (task 1) chooses between `await connection()` in the layout and dropping `generateStaticParams` for `[server]`; the chosen approach is recorded in an ADR note and reused by site-content phase 2.

## 7. Testing

| Layer                 | What                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (`@shop/shared`) | schemas accept the seed data, reject bad locale/currency/sections                                                                                                   |
| Unit (api)            | `ValibotPipe` 400 shape; catalog mapper: locale fallback, ordering, product without a price omitted, secret fields absent                                           |
| Integration (api)     | Testcontainers Postgres: migrations apply to an empty DB; seed runs twice without duplicates; `GET /api/catalog?locale=pl` returns seeded data; `400` on bad locale |
| Unit/component (web)  | `getCatalog` parse + error; `CatalogProvider` lookups; existing component tests rewired to a test catalog fixture                                                   |
| E2E (Playwright)      | home and `/anarchy` show seeded products; product modal opens; cart survives reload and drops a product that is no longer in the catalog; `/pl` shows PL names      |
| CI                    | `openapi.json` diff check; `prisma migrate diff` check; `pnpm build` of web with no API                                                                             |

## 8. Out of scope

- Admin editing of the catalog and on-demand revalidation (sub-project 3).
- RCON encryption and connection test (sub-project 3).
- Orders, prices at checkout, promo codes (sub-project 4); cases and prize tables (sub-project 7).
- Redis cache, RTK Query codegen.
- Product images (`imageKey`, R2): the storefront uses icons today.

## 9. Parent spec updates (part of this sub-project)

- Decision #12 and §6.2: product belongs to one server; `product_offerings` removed; `server_categories` added; presentation fields (`accent`, `onAccent`, `mark`, `icon`, `sections`).
- §8 item 3: catalog cache is the web data cache, not Redis.
- §15 row 2: "catalog tables" instead of "all tables"; RTK Query codegen moves to row 3.
- §11.1: "ISR `revalidate: 60`" wording replaced by the approach chosen in the spike.
