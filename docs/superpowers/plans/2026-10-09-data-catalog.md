# Data and Catalog (Sub-project 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the storefront's servers, categories and products from Postgres through `GET /api/catalog`, and switch `apps/web` from its demo files to that API with no visible change.

**Architecture:** Prisma 7 (catalog tables only) in `apps/api`, a `catalog` Nest module whose pure mapper turns rows into the public response, and Valibot schemas in a new `@shop/shared` package that define the contract for the API, the OpenAPI document and the web parser. `web` loads the catalog on the server (`getCatalog`, Next data cache, 60 s), hands it to Client Components through `CatalogProvider`, and renders at request time so `next build` never calls the API.

**Tech Stack:** NestJS 11, Prisma 7.10 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL 18, Valibot 1.5 + `@valibot/to-json-schema`, `@nestjs/swagger` 11 (UI only), Testcontainers 12, Next.js 16, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-data-catalog-design.md` (parent: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`).

## Global Constraints

- Business logic only in `apps/api`; `apps/web` gets no route handlers (CLAUDE.md).
- Money is `amountMinor: Int` + `currency` (`EUR` | `PLN`); never floats.
- Product belongs to one server; categories are global with a per-server order (`server_categories`).
- Tables in scope: catalog only (`servers`, `categories`, `category_translations`, `server_categories`, `products`, `product_translations`, `prices`).
- No Redis cache for the catalog; no RTK Query codegen in this sub-project.
- `locale` is always an explicit `?locale=en|pl` parameter; never read from cookies.
- Public responses never include `rconHost`, `rconPort`, `rconPasswordEnc`, `grantCommands`, `revokeCommands` or database ids.
- `next build` must succeed with no API or database reachable.
- Versions: `prisma`, `@prisma/client`, `@prisma/adapter-pg` `^7.10.0` (npm `latest` for `prisma` is an 8.0 RC; do not use it); `@nestjs/swagger` `^11.4.7` (12.x needs Nest 12); `valibot` `^1.5.0`; `@valibot/to-json-schema` `^1.8.0`; `@testcontainers/postgresql` `^12.2.0`; `tsx` `^4.23.0`. Do not bump Nest, ESLint (9) or TypeScript (6) majors.
- Lint is `typescript-eslint` strict-type-checked: numbers in template literals need `String(n)`; `async` functions need an `await`; no non-null assertions.
- TDD: failing test first. Before every commit (repo root): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query "<question>"` before grepping; run `graphify update .` after code changes (put this line in every subagent prompt).
- Local Postgres for migrations: `docker compose up -d postgres` (user/password/db `shop`, port 5432).

## Review Focus

1. **API unreachable at runtime with nothing cached** → pages render with an "unavailable" shop section, not a 500; rules and legal links still work. Pinned by the `loadCatalog` returns-null test (Task 11) and the `Catalog` unavailable-state test (Task 13).
2. **A product with no text in the requested locale and none in `en`** → omitted from the response with a `warn` log, the rest of the catalog still served. Pinned in the mapper tests (Task 6).
3. **`?locale=PL`, `?locale=en&locale=pl`, missing locale** → `400`, never `500`. Pinned in the pipe and controller tests (Tasks 5, 7).
4. **Saved cart in `localStorage` that references a product no longer in the catalog** (deleted, or slug changed) → silently dropped on load. Pinned by the e2e test (Task 15) and the `ShopProvider` test (Task 14).
5. **Seed run twice, or after an admin edit** → no duplicates and no overwrite of existing rows. Pinned by the seed integration test (Task 4).

---

## File map

| File                                                                                    | Responsibility                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/shared/src/catalog.ts`                                                        | Valibot schemas + types for the catalog contract       |
| `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `migrations/`             | Prisma CLI config, schema, SQL                         |
| `apps/api/src/prisma/database-url.ts`, `prisma.service.ts`, `prisma.module.ts`          | DB URL, lazy client, global module                     |
| `apps/api/src/seed/demo-*.ts`, `seed-catalog.ts`, `main.ts`                             | demo data (moved from web), idempotent seed, CLI entry |
| `apps/api/src/common/valibot.pipe.ts`                                                   | request validation                                     |
| `apps/api/src/catalog/catalog.mapper.ts`                                                | rows → `CatalogResponse` (pure)                        |
| `apps/api/src/catalog/catalog.service.ts`, `catalog.controller.ts`, `catalog.module.ts` | query + endpoint                                       |
| `apps/api/src/health/health.controller.ts`                                              | adds `/api/health/ready`                               |
| `apps/api/src/openapi/openapi.ts`, `write-openapi.ts`, `apps/api/openapi.json`          | contract document, Swagger UI                          |
| `apps/api/test/support/database.ts`, `test/*.int-spec.ts`                               | Testcontainers integration tests                       |
| `apps/web/src/features/catalog/api/get-catalog.ts`                                      | server read + safe loader                              |
| `apps/web/src/features/catalog/catalog-provider.tsx`                                    | client context `useCatalog()`                          |
| `apps/web/src/features/catalog/test-catalog.ts`                                         | test fixture + `renderWithCatalog`                     |
| `compose.e2e.yaml`, `apps/api/Dockerfile`, `.github/workflows/ci.yml`, `turbo.json`     | migrate service, env, CI steps                         |
| `e2e/tests/catalog.spec.ts`                                                             | browser checks                                         |
| `docs/adr/0007-request-time-rendering.md`                                               | build-without-API decision                             |

---

### Task 1: Render at request time (build without API)

**Files:**

- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/[server]/page.tsx`
- Create: `docs/adr/0007-request-time-rendering.md`

**Interfaces:**

- Produces: every `[locale]` route renders per request; later tasks may `fetch` the API in the layout and pages with `next: {revalidate: 60}` without breaking `next build`.

This task has no unit test: the deliverable is a build property. The proof is a production build with the API stopped, plus the existing e2e suite.

- [ ] **Step 1: Prove the current build would break once the layout fetches**

Temporarily add as the first line of `LocaleLayout`'s body: `await fetch('http://127.0.0.1:9/never')`. Run `pnpm --filter @shop/web build`.
Expected: FAIL during "Generating static pages" with a fetch error. Remove the line.

- [ ] **Step 2: Make the layout request-time**

In `apps/web/src/app/[locale]/layout.tsx`:

1. Delete `export const revalidate = 86_400` and its comment, and delete `generateStaticParams`.
2. Add `import {connection} from 'next/server'`.
3. As the first statement of `LocaleLayout`, add:

```tsx
// Catalog and content come from the API, which is not reachable during `next build`:
// render per request and let the data cache (60 s) keep it cheap. See ADR 0007.
await connection()
```

- [ ] **Step 3: Drop static params for servers**

In `apps/web/src/app/[locale]/[server]/page.tsx` delete `generateStaticParams` and the `servers` import (`findServer` stays until Task 12).

- [ ] **Step 4: Prove the build passes with the fetch present**

Re-add the temporary `await fetch('http://127.0.0.1:9/never').catch(() => undefined)` right after `await connection()`. Run `pnpm --filter @shop/web build`.
Expected: PASS; the route table shows `ƒ` (dynamic) for `/[locale]` routes. Remove the temporary line.

- [ ] **Step 5: Write ADR 0007**

```markdown
# ADR 0007: Request-time rendering for API data

- Status: Accepted
- Date: 2026-10-09

## Context

The storefront reads the catalog (and later site content) from `apps/api`. CI builds the web image on GitHub runners where neither the API nor Postgres runs (ADR 0003), so any page that fetches during `next build` fails the build.

## Decision

`app/[locale]/layout.tsx` calls `await connection()` before reading data, so every `[locale]` route renders per request. Data is fetched with `fetch(url, {next: {revalidate: 60, tags: [...]}})`: the Next data cache serves repeat requests and refreshes in the background. No `generateStaticParams` for data-driven segments; unknown slugs are checked against the fetched data and `notFound()` is called.

## Consequences

- `next build` never contacts the API.
- Each page view renders on the server (cheap: data comes from the cache), so TTFB includes a render but no API round trip after the first request per minute.
- When the API is down and the cache is empty, pages render an "unavailable" state for the shop instead of failing.
- Site-content phase 2 (`docs/superpowers/specs/2026-10-09-site-content-design.md`) reuses this approach; its ADR becomes 0008.
```

In `docs/superpowers/specs/2026-10-09-site-content-design.md` replace `ADR 0007` with `ADR 0008` (two occurrences: §9 phase 2 step 7 and §12).

- [ ] **Step 6: Run the existing suites**

Run (repo root): `pnpm --filter @shop/web test` → PASS. Then `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm --filter @shop/e2e test:e2e` → PASS (a single `morph-popover` animation-timing failure that passes on rerun is pre-existing).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app docs/adr/0007-request-time-rendering.md docs/superpowers/specs/2026-10-09-site-content-design.md
git commit -m "feat(web): render locale routes at request time so builds never call the API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `@shop/shared` with the catalog contract

**Files:**

- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.build.json`, `packages/shared/eslint.config.mjs`
- Create: `packages/shared/src/catalog.ts`
- Test: `packages/shared/src/catalog.spec.ts`

**Interfaces:**

- Produces (import path `@shop/shared/catalog`):
  - consts `LOCALES = ['en', 'pl']`, `CURRENCIES = ['EUR', 'PLN']`, `PRODUCT_KINDS = ['PERMANENT', 'TIMED', 'CASE']`, `PRODUCT_ICONS = ['crown', 'box', 'coins', 'swords', 'pickaxe', 'ticket']`
  - schemas `LocaleSchema`, `CurrencySchema`, `ProductEntrySchema`, `ProductSectionSchema`, `CatalogQuerySchema`, `CatalogServerSchema`, `CatalogProductSchema`, `CatalogResponseSchema`
  - types `Locale`, `Currency`, `ProductKind`, `ProductIcon`, `ProductEntry`, `ProductSection`, `CatalogQuery`, `CatalogServer`, `CatalogProduct`, `CatalogResponse`

- [ ] **Step 1: Create the package skeleton**

`packages/shared/package.json`:

```json
{
  "name": "@shop/shared",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./catalog": {"types": "./dist/catalog.d.ts", "default": "./dist/catalog.js"}
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "jest": {
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {"^.+\\.ts$": "ts-jest"},
    "testEnvironment": "node"
  },
  "dependencies": {
    "valibot": "^1.5.0"
  },
  "devDependencies": {
    "@shop/config": "workspace:*",
    "@types/jest": "^30.0.0",
    "@types/node": "^26.6.3",
    "eslint": "^9.39.5",
    "jest": "^30.5.2",
    "ts-jest": "^29.4.14",
    "typescript": "^6.0.3"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "@shop/config/tsconfig/base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "types": ["node", "jest"]
  },
  "include": ["src"]
}
```

`packages/shared/tsconfig.build.json`:

```json
{"extends": "./tsconfig.json", "exclude": ["src/**/*.spec.ts"]}
```

`packages/shared/eslint.config.mjs`:

```js
import {base} from '@shop/config/eslint/base'

export default base
```

The package has no `"type"`, so `nodenext` emits CommonJS that both Nest (CJS) and Next can load.

Run: `pnpm install`.

- [ ] **Step 2: Write the failing test**

```ts
// packages/shared/src/catalog.spec.ts
import * as v from 'valibot'

import {CatalogQuerySchema, CatalogResponseSchema, ProductSectionSchema} from './catalog'

const product = {
  server: 'survival',
  category: 'ranks',
  slug: 'vip',
  kind: 'TIMED',
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown',
  name: 'VIP',
  description: 'Coloured nickname.',
  sections: [
    {title: 'Kits', entries: [{cmd: '/kit vip', text: 'Diamond tools', cooldown: '24 h'}]}
  ],
  prices: {EUR: 499, PLN: 2199}
}

const catalog = {
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [{slug: 'ranks', name: 'Ranks'}]
    }
  ],
  products: [product]
}

describe('CatalogQuerySchema', () => {
  it.each(['en', 'pl'])('accepts locale %s', locale => {
    expect(v.parse(CatalogQuerySchema, {locale})).toEqual({locale})
  })

  it.each([undefined, 'PL', 'de', ['en', 'pl']])('rejects locale %p', locale => {
    expect(v.safeParse(CatalogQuerySchema, {locale}).success).toBe(false)
  })
})

describe('CatalogResponseSchema', () => {
  it('accepts a valid catalog', () => {
    expect(v.parse(CatalogResponseSchema, catalog)).toEqual(catalog)
  })

  it.each([
    ['a float price', {prices: {EUR: 4.99, PLN: 2199}}],
    ['a zero price', {prices: {EUR: 0, PLN: 2199}}],
    ['an unknown currency', {prices: {EUR: 499, USD: 2199}}],
    ['an unknown icon', {icon: 'star'}],
    ['an unknown kind', {kind: 'RENTAL'}]
  ])('rejects %s', (_, patch) => {
    const bad = {...catalog, products: [{...product, ...patch}]}
    expect(v.safeParse(CatalogResponseSchema, bad).success).toBe(false)
  })
})

describe('ProductSectionSchema', () => {
  it('rejects a section without a title', () => {
    expect(v.safeParse(ProductSectionSchema, {entries: []}).success).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @shop/shared exec jest`
Expected: FAIL, "Cannot find module './catalog'".

- [ ] **Step 4: Implement**

```ts
// packages/shared/src/catalog.ts
import * as v from 'valibot'

export const LOCALES = ['en', 'pl'] as const
export const CURRENCIES = ['EUR', 'PLN'] as const
export const PRODUCT_KINDS = ['PERMANENT', 'TIMED', 'CASE'] as const
export const PRODUCT_ICONS = ['crown', 'box', 'coins', 'swords', 'pickaxe', 'ticket'] as const

export const LocaleSchema = v.picklist(LOCALES)
export const CurrencySchema = v.picklist(CURRENCIES)

const MinorAmount = v.pipe(v.number(), v.integer(), v.minValue(1))

/** One line of a description block: an optional copyable command, an explanation, an optional cooldown tag. */
export const ProductEntrySchema = v.object({
  cmd: v.optional(v.string()),
  text: v.optional(v.string()),
  cooldown: v.optional(v.string())
})

export const ProductSectionSchema = v.object({
  title: v.string(),
  entries: v.array(ProductEntrySchema)
})

export const CatalogQuerySchema = v.object({locale: LocaleSchema})

export const CatalogServerSchema = v.object({
  slug: v.string(),
  name: v.string(),
  accent: v.string(),
  onAccent: v.string(),
  /** In this server's display order. */
  categories: v.array(v.object({slug: v.string(), name: v.string()}))
})

export const CatalogProductSchema = v.object({
  server: v.string(),
  category: v.string(),
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  name: v.string(),
  description: v.string(),
  sections: v.array(ProductSectionSchema),
  prices: v.strictObject({EUR: MinorAmount, PLN: MinorAmount})
})

export const CatalogResponseSchema = v.object({
  servers: v.array(CatalogServerSchema),
  products: v.array(CatalogProductSchema)
})

export type Locale = v.InferOutput<typeof LocaleSchema>
export type Currency = v.InferOutput<typeof CurrencySchema>
export type ProductKind = (typeof PRODUCT_KINDS)[number]
export type ProductIcon = (typeof PRODUCT_ICONS)[number]
export type ProductEntry = v.InferOutput<typeof ProductEntrySchema>
export type ProductSection = v.InferOutput<typeof ProductSectionSchema>
export type CatalogQuery = v.InferOutput<typeof CatalogQuerySchema>
export type CatalogServer = v.InferOutput<typeof CatalogServerSchema>
export type CatalogProduct = v.InferOutput<typeof CatalogProductSchema>
export type CatalogResponse = v.InferOutput<typeof CatalogResponseSchema>
```

- [ ] **Step 5: Run tests, build, lint**

Run: `pnpm --filter @shop/shared exec jest && pnpm --filter @shop/shared build && pnpm --filter @shop/shared lint && pnpm --filter @shop/shared typecheck`
Expected: PASS; `packages/shared/dist/catalog.js` and `catalog.d.ts` exist.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): catalog contract schemas in @shop/shared

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Prisma schema, migration and client

**Files:**

- Modify: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/eslint.config.mjs`, `turbo.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierignore`
- Create: `.env.example`
- Create: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_catalog/migration.sql`
- Create: `apps/api/src/prisma/database-url.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/test/support/database.ts`
- Test: `apps/api/test/database.int-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Produces:
  - `databaseUrl(): string`
  - `PrismaService` (extends generated `PrismaClient`, lazy connect), `PrismaModule` (global, exports `PrismaService`)
  - `startDatabase(): Promise<{url: string; stop: () => Promise<void>}>` (test helper: Postgres container with migrations applied)
  - generated client at `apps/api/src/generated/prisma/client` (models `server`, `category`, `categoryTranslation`, `serverCategory`, `product`, `productTranslation`, `price`)
  - scripts in `@shop/api`: `generate`, `test:int`, `seed` (Task 4), `openapi` (Task 9)

- [ ] **Step 1: Add dependencies and scripts**

In `apps/api/package.json`:

- `dependencies` add: `"@prisma/adapter-pg": "^7.10.0"`, `"@prisma/client": "^7.10.0"`, `"@shop/shared": "workspace:*"`, `"prisma": "^7.10.0"`, `"valibot": "^1.5.0"`. (`prisma` is a runtime dependency because the `migrate` container runs it from the production image.)
- `devDependencies` add: `"@testcontainers/postgresql": "^12.2.0"`, `"tsx": "^4.23.0"`.
- `files`: `["dist", "prisma", "prisma.config.ts", "src/prisma/database-url.ts"]`.
- `scripts` add: `"generate": "prisma generate"`, `"test:int": "jest --testRegex '.*\\.int-spec\\.ts$' --runInBand"`.

In `pnpm-workspace.yaml` under `allowBuilds` add `'@prisma/engines': true` and `prisma: true` (they download the schema engine used by `migrate`).

In `turbo.json`, add a `generate` task and make the others depend on it:

```json
    "generate": {"inputs": ["prisma/schema.prisma"], "outputs": ["src/generated/**"]},
    "build": {"dependsOn": ["^build", "generate"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"]},
    "lint": {"dependsOn": ["^build", "generate"]},
    "typecheck": {"dependsOn": ["^build", "generate"]},
    "test": {"dependsOn": ["^build", "generate"], "outputs": ["coverage/**"]},
    "test:int": {"dependsOn": ["^build", "generate"], "cache": false},
```

(Packages without a `generate` script skip it.)

Root `package.json` scripts: add `"test:int": "turbo run test:int"`.

`.gitignore` and `.prettierignore`: add `apps/api/src/generated/`.

`apps/api/eslint.config.mjs`:

```js
import {defineConfig} from 'eslint/config'

import {base} from '@shop/config/eslint/base'

export default defineConfig(base, {ignores: ['src/generated/**']})
```

`apps/api/tsconfig.json`: `"include": ["src", "test", "prisma.config.ts"]`.

`.env.example` (repo root):

```bash
# apps/api — Postgres from `docker compose up -d postgres`
DATABASE_URL=postgresql://shop:shop@localhost:5432/shop
# apps/web — where the server fetches the API from
API_ORIGIN=http://localhost:4000
```

Run: `pnpm install`.

- [ ] **Step 2: Write the schema and config**

```ts
// apps/api/src/prisma/database-url.ts
/** Local default matches `compose.yaml`; every deployed environment sets DATABASE_URL. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://shop:shop@localhost:5432/shop'
}
```

```ts
// apps/api/prisma.config.ts
import {defineConfig} from 'prisma/config'

import {databaseUrl} from './src/prisma/database-url'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {path: 'prisma/migrations'},
  datasource: {url: databaseUrl()}
})
```

`apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum Locale {
  en
  pl
}

enum Currency {
  EUR
  PLN
}

enum ProductKind {
  PERMANENT
  TIMED
  CASE
}

enum ProductIcon {
  crown
  box
  coins
  swords
  pickaxe
  ticket
}

model Server {
  id              String           @id @default(cuid())
  slug            String           @unique
  name            String
  accent          String
  onAccent        String
  rconHost        String?
  rconPort        Int?
  rconPasswordEnc String?
  isActive        Boolean          @default(true)
  sort            Int              @default(0)
  categories      ServerCategory[]
  products        Product[]

  @@map("servers")
}

model Category {
  id           String                @id @default(cuid())
  slug         String                @unique
  translations CategoryTranslation[]
  servers      ServerCategory[]
  products     Product[]

  @@map("categories")
}

model CategoryTranslation {
  categoryId String
  locale     Locale
  name       String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([categoryId, locale])
  @@map("category_translations")
}

model ServerCategory {
  serverId   String
  categoryId String
  sort       Int
  server     Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@id([serverId, categoryId])
  @@index([categoryId])
  @@map("server_categories")
}

model Product {
  id             String               @id @default(cuid())
  serverId       String
  categoryId     String
  slug           String
  kind           ProductKind
  durationDays   Int?
  mark           String
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
  @@map("products")
}

model ProductTranslation {
  productId   String
  locale      Locale
  name        String
  description String
  sections    Json
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([productId, locale])
  @@map("product_translations")
}

model Price {
  productId   String
  currency    Currency
  amountMinor Int
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([productId, currency])
  @@map("prices")
}
```

Run: `pnpm --filter @shop/api generate`
Expected: "Generated Prisma Client … to ./src/generated/prisma".

- [ ] **Step 3: Create the migration**

Run: `docker compose up -d postgres && pnpm --filter @shop/api exec prisma migrate dev --name catalog --create-only`
Expected: `apps/api/prisma/migrations/<timestamp>_catalog/migration.sql` created. Read the SQL: seven tables, four enums, foreign keys and indexes as in the schema.

Append to that `migration.sql`:

```sql
-- Not expressible in Prisma schema: keep kind and duration consistent, prices positive.
ALTER TABLE "products" ADD CONSTRAINT "products_duration_matches_kind"
  CHECK (("kind" = 'TIMED') = ("durationDays" IS NOT NULL));
ALTER TABLE "prices" ADD CONSTRAINT "prices_amount_positive" CHECK ("amountMinor" > 0);
```

Run: `pnpm --filter @shop/api exec prisma migrate dev`
Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Write the test helper and the failing integration test**

```ts
// apps/api/test/support/database.ts
import {execFileSync} from 'node:child_process'
import path from 'node:path'

import {PostgreSqlContainer} from '@testcontainers/postgresql'

export const API_ROOT = path.resolve(__dirname, '..', '..')

export function prisma(args: string[], url: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_ROOT,
    env: {...process.env, DATABASE_URL: url},
    encoding: 'utf8'
  })
}

/** A throwaway Postgres with all migrations applied; sets DATABASE_URL for clients created afterwards. */
export async function startDatabase(): Promise<{url: string; stop: () => Promise<void>}> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start()
  const url = container.getConnectionUri()
  prisma(['migrate', 'deploy'], url)
  process.env.DATABASE_URL = url
  return {
    url,
    stop: async () => {
      await container.stop()
    }
  }
}
```

```ts
// apps/api/test/database.int-spec.ts
import {PrismaService} from '../src/prisma/prisma.service'
import {prisma, startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('database', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let client: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    client = new PrismaService()
  })

  afterAll(async () => {
    await client.$disconnect()
    await db.stop()
  })

  it('migrations match the schema (no drift)', () => {
    // --exit-code: 0 = no difference, 2 = difference (execFileSync throws on non-zero).
    expect(() =>
      prisma(
        [
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema.prisma',
          '--exit-code'
        ],
        db.url
      )
    ).not.toThrow()
  })

  const product = async (slug: string, kind: 'TIMED' | 'PERMANENT') => {
    const server = await client.server.upsert({
      where: {slug: 's'},
      update: {},
      create: {slug: 's', name: 'S', accent: '#000', onAccent: '#fff'}
    })
    const category = await client.category.upsert({
      where: {slug: 'c'},
      update: {},
      create: {slug: 'c'}
    })
    return client.product.create({
      data: {
        serverId: server.id,
        categoryId: category.id,
        slug,
        kind,
        mark: 'P',
        icon: 'crown',
        grantCommands: [],
        revokeCommands: []
      }
    })
  }

  it('rejects a TIMED product without a duration', async () => {
    await expect(product('timed', 'TIMED')).rejects.toThrow(/products_duration_matches_kind/)
  })

  it('rejects a zero price', async () => {
    const {id} = await product('permanent', 'PERMANENT')
    await expect(
      client.price.create({data: {productId: id, currency: 'EUR', amountMinor: 0}})
    ).rejects.toThrow(/prices_amount_positive/)
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm --filter @shop/api test:int`
Expected: FAIL, "Cannot find module '../src/prisma/prisma.service'".

- [ ] **Step 6: Implement the service and module**

```ts
// apps/api/src/prisma/prisma.service.ts
import {Injectable, type OnModuleDestroy} from '@nestjs/common'
import {PrismaPg} from '@prisma/adapter-pg'

import {PrismaClient} from '../generated/prisma/client'
import {databaseUrl} from './database-url'

/** Connects on the first query, so the app and its tests boot without a database. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({adapter: new PrismaPg({connectionString: databaseUrl()})})
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
```

```ts
// apps/api/src/prisma/prisma.module.ts
import {Global, Module} from '@nestjs/common'

import {PrismaService} from './prisma.service'

@Global()
@Module({providers: [PrismaService], exports: [PrismaService]})
export class PrismaModule {}
```

In `apps/api/src/app.module.ts` add `PrismaModule` to `imports` (import from `./prisma/prisma.module`).

- [ ] **Step 7: Run integration and unit tests**

Run: `pnpm --filter @shop/api test:int && pnpm --filter @shop/api test && pnpm --filter @shop/api lint && pnpm --filter @shop/api typecheck`
Expected: integration 3/3 PASS; existing health and status tests still PASS (no database needed at boot).

- [ ] **Step 8: Run integration tests in CI**

In `.github/workflows/ci.yml`, job `quality`, after `- run: pnpm test` add:

```yaml
# Testcontainers: Docker is available on ubuntu-latest runners.
- run: pnpm test:int
```

- [ ] **Step 9: Commit**

```bash
git add apps/api turbo.json pnpm-workspace.yaml pnpm-lock.yaml package.json .gitignore .prettierignore .env.example .github/workflows/ci.yml
git commit -m "feat(api): Prisma catalog schema with migration and lazy client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Demo data and idempotent seed

**Files:**

- Move: `apps/web/src/config/products.ts` → `apps/api/src/seed/demo-products.ts` (`git mv`)
- Create: `apps/api/src/seed/demo-catalog.ts` (servers + categories)
- Create: `apps/api/src/seed/seed-catalog.ts`, `apps/api/src/seed/main.ts`
- Test: `apps/api/src/seed/demo-catalog.spec.ts`, `apps/api/test/seed.int-spec.ts`

**Interfaces:**

- Consumes: `PrismaService` (Task 3), `LOCALES`, `CURRENCIES`, `ProductSectionSchema`, types from `@shop/shared/catalog` (Task 2).
- Produces: `DEMO_SERVERS`, `DEMO_CATEGORIES`, `DEMO_PRODUCTS`; `seedCatalog(prisma: PrismaClient): Promise<void>`; script `pnpm --filter @shop/api seed`; compiled entry `dist/seed/main.js`.

`apps/web` keeps importing `@/config/products` until Task 14; this task copies, not moves: use `cp` now, and Task 14 deletes the web file.

- [ ] **Step 1: Copy the demo products into the API**

Run: `mkdir -p apps/api/src/seed && cp apps/web/src/config/products.ts apps/api/src/seed/demo-products.ts`

In `apps/api/src/seed/demo-products.ts`:

1. Replace the first comment and the three imports with:

```ts
// Demo catalog, moved from apps/web/src/config/products.ts. Seeded into an empty database; never overwrites.
import type {Currency, Locale, ProductIcon} from '@shop/shared/catalog'

import type {CategoryId} from './demo-catalog'
```

2. Delete the line `export type ProductIcon = 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'`.
3. Rename `export const products: Product[]` to `export const DEMO_PRODUCTS: Product[]`.

- [ ] **Step 2: Write servers and categories**

```ts
// apps/api/src/seed/demo-catalog.ts
import type {Locale} from '@shop/shared/catalog'

export type CategoryId = 'ranks' | 'cases' | 'currency' | 'kits' | 'cosmetics'

export const DEMO_CATEGORIES: {slug: CategoryId; names: Record<Locale, string>}[] = [
  {slug: 'ranks', names: {en: 'Ranks', pl: 'Rangi'}},
  {slug: 'cases', names: {en: 'Cases', pl: 'Skrzynki'}},
  {slug: 'currency', names: {en: 'Currency', pl: 'Waluta'}},
  {slug: 'kits', names: {en: 'Kits', pl: 'Zestawy'}},
  {slug: 'cosmetics', names: {en: 'Cosmetics', pl: 'Kosmetyki'}}
]

/** Servers in display order; `categories` in each server's own order (a category may have no products). */
export const DEMO_SERVERS: {
  slug: string
  name: string
  accent: string
  onAccent: string
  categories: CategoryId[]
}[] = [
  {
    slug: 'survival',
    name: 'Survival',
    accent: '#ff6b1a',
    onAccent: '#0e0e10',
    categories: ['ranks', 'cases', 'currency', 'kits']
  },
  {
    slug: 'anarchy',
    name: 'Anarchy',
    accent: '#7b3ff2',
    onAccent: '#ffffff',
    categories: ['kits', 'ranks', 'cases', 'currency']
  },
  {
    slug: 'minigames',
    name: 'Minigames',
    accent: '#d92b52',
    onAccent: '#ffffff',
    categories: ['ranks', 'cases', 'currency', 'cosmetics']
  }
]
```

- [ ] **Step 3: Write the failing data test**

```ts
// apps/api/src/seed/demo-catalog.spec.ts
import * as v from 'valibot'

import {LOCALES, ProductSectionSchema} from '@shop/shared/catalog'

import {DEMO_CATEGORIES, DEMO_SERVERS} from './demo-catalog'
import {DEMO_PRODUCTS} from './demo-products'

describe('demo catalog', () => {
  it('has 3 servers, 5 categories and 20 products', () => {
    expect([DEMO_SERVERS.length, DEMO_CATEGORIES.length, DEMO_PRODUCTS.length]).toEqual([3, 5, 20])
  })

  it('puts every product on a known server, in a category that server lists', () => {
    for (const p of DEMO_PRODUCTS) {
      const server = DEMO_SERVERS.find(s => s.slug === p.server)
      expect(server?.categories).toContain(p.category)
    }
  })

  it('has unique slugs per server', () => {
    const keys = DEMO_PRODUCTS.map(p => `${p.server}/${p.slug}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has valid sections and positive prices in both currencies', () => {
    for (const p of DEMO_PRODUCTS) {
      for (const locale of LOCALES)
        expect(v.safeParse(v.array(ProductSectionSchema), p.sections?.[locale] ?? []).success).toBe(
          true
        )
      expect(p.price.EUR).toBeGreaterThan(0)
      expect(p.price.PLN).toBeGreaterThan(0)
    }
  })
})
```

Run: `pnpm --filter @shop/api exec jest src/seed`
Expected: FAIL, "Cannot find module './demo-catalog'" if step 2 is not saved yet, otherwise PASS. If it passes immediately, temporarily change `toEqual([3, 5, 20])` to `[3, 5, 21]` to see it fail, then restore.

- [ ] **Step 4: Write the failing seed integration test**

```ts
// apps/api/test/seed.int-spec.ts
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('seedCatalog', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let client: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    client = new PrismaService()
  })

  afterAll(async () => {
    await client.$disconnect()
    await db.stop()
  })

  const counts = async () => [
    await client.server.count(),
    await client.category.count(),
    await client.serverCategory.count(),
    await client.product.count(),
    await client.productTranslation.count(),
    await client.price.count()
  ]

  it('loads the demo catalog', async () => {
    await seedCatalog(client)
    expect(await counts()).toEqual([3, 5, 12, 20, 40, 40])
  })

  it('is idempotent and never overwrites existing rows', async () => {
    await client.server.update({where: {slug: 'survival'}, data: {name: 'Edited'}})
    await seedCatalog(client)
    expect(await counts()).toEqual([3, 5, 12, 20, 40, 40])
    expect((await client.server.findUniqueOrThrow({where: {slug: 'survival'}})).name).toBe('Edited')
  })

  it('maps demo flags to kinds', async () => {
    const vip = await client.product.findFirstOrThrow({where: {slug: 'vip'}})
    const mythic = await client.product.findFirstOrThrow({where: {slug: 'mythic-case'}})
    expect([vip.kind, vip.durationDays]).toEqual(['TIMED', 30])
    expect([mythic.kind, mythic.durationDays]).toEqual(['CASE', null])
  })
})
```

Run: `pnpm --filter @shop/api test:int`
Expected: FAIL, "Cannot find module '../src/seed/seed-catalog'".

- [ ] **Step 5: Implement the seed**

```ts
// apps/api/src/seed/seed-catalog.ts
import {CURRENCIES, LOCALES} from '@shop/shared/catalog'

import type {Prisma, PrismaClient} from '../generated/prisma/client'
import {DEMO_CATEGORIES, DEMO_SERVERS} from './demo-catalog'
import {DEMO_PRODUCTS, type Product} from './demo-products'

function required<V>(map: Map<string, V>, key: string): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`seed: unknown ${key}`)
  return value
}

/** CASE wins over a duration; a duration alone makes a TIMED product. */
function kindOf(p: Product) {
  if (p.adult) return {kind: 'CASE' as const, durationDays: null}
  if (p.durationDays) return {kind: 'TIMED' as const, durationDays: p.durationDays}
  return {kind: 'PERMANENT' as const, durationDays: null}
}

/** Creates whatever is missing and never updates existing rows, so later admin edits survive a re-run. */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const categoryIds = new Map<string, string>()
  for (const c of DEMO_CATEGORIES) {
    const row = await prisma.category.upsert({
      where: {slug: c.slug},
      update: {},
      create: {
        slug: c.slug,
        translations: {create: LOCALES.map(locale => ({locale, name: c.names[locale]}))}
      }
    })
    categoryIds.set(c.slug, row.id)
  }

  for (const [i, s] of DEMO_SERVERS.entries()) {
    const server = await prisma.server.upsert({
      where: {slug: s.slug},
      update: {},
      create: {slug: s.slug, name: s.name, accent: s.accent, onAccent: s.onAccent, sort: i}
    })

    for (const [j, slug] of s.categories.entries()) {
      const categoryId = required(categoryIds, slug)
      await prisma.serverCategory.upsert({
        where: {serverId_categoryId: {serverId: server.id, categoryId}},
        update: {},
        create: {serverId: server.id, categoryId, sort: j}
      })
    }

    for (const [k, p] of DEMO_PRODUCTS.filter(p => p.server === s.slug).entries()) {
      await prisma.product.upsert({
        where: {serverId_slug: {serverId: server.id, slug: p.slug}},
        update: {},
        create: {
          serverId: server.id,
          categoryId: required(categoryIds, p.category),
          slug: p.slug,
          ...kindOf(p),
          mark: p.mark,
          icon: p.icon,
          // Placeholder until delivery (sub-project 5) defines real commands per product.
          grantCommands: [`say [demo] {nick} bought ${p.slug}`],
          revokeCommands: [],
          sort: k,
          translations: {
            create: LOCALES.map(locale => ({
              locale,
              name: p.name,
              description: p.description[locale],
              sections: (p.sections?.[locale] ?? []) as Prisma.InputJsonArray
            }))
          },
          prices: {create: CURRENCIES.map(currency => ({currency, amountMinor: p.price[currency]}))}
        }
      })
    }
  }
}
```

If lint flags the `as Prisma.InputJsonArray` assertion as unnecessary, remove it; if TypeScript rejects `Section[]` without it, keep it.

```ts
// apps/api/src/seed/main.ts
import {PrismaService} from '../prisma/prisma.service'
import {seedCatalog} from './seed-catalog'

const prisma = new PrismaService()

seedCatalog(prisma)
  .then(() => {
    console.log('seed: catalog ready')
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
```

In `apps/api/package.json` scripts add `"seed": "tsx src/seed/main.ts"`. (The production image runs the compiled `node dist/seed/main.js`.)

- [ ] **Step 6: Run the tests and seed the local database**

Run: `pnpm --filter @shop/api exec jest src/seed && pnpm --filter @shop/api test:int && pnpm --filter @shop/api seed`
Expected: PASS; last command prints `seed: catalog ready`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/seed apps/api/test/seed.int-spec.ts apps/api/package.json
git commit -m "feat(api): idempotent catalog seed from the storefront demo data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `ValibotPipe`

**Files:**

- Create: `apps/api/src/common/valibot.pipe.ts`
- Test: `apps/api/src/common/valibot.pipe.spec.ts`

**Interfaces:**

- Produces: `class ValibotPipe<S extends v.GenericSchema> implements PipeTransform` with `constructor(schema: S)` and `transform(value: unknown): v.InferOutput<S>`; failure throws `BadRequestException` with body `{statusCode: 400, message: 'Validation failed', issues: v.FlatErrors}`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/common/valibot.pipe.spec.ts
import {BadRequestException} from '@nestjs/common'

import {CatalogQuerySchema} from '@shop/shared/catalog'

import {ValibotPipe} from './valibot.pipe'

describe('ValibotPipe', () => {
  const pipe = new ValibotPipe(CatalogQuerySchema)

  it('returns the parsed value', () => {
    expect(pipe.transform({locale: 'pl', extra: 'x'})).toEqual({locale: 'pl'})
  })

  it.each([{}, {locale: 'PL'}, {locale: ['en', 'pl']}])('throws 400 for %p', query => {
    expect(() => pipe.transform(query)).toThrow(BadRequestException)
  })

  it('reports which field failed', () => {
    try {
      pipe.transform({locale: 'de'})
      throw new Error('expected a BadRequestException')
    } catch (error) {
      const body = (error as BadRequestException).getResponse() as {
        message: string
        issues: {nested?: Record<string, string[]>}
      }
      expect(body.message).toBe('Validation failed')
      expect(body.issues.nested?.locale).toHaveLength(1)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/api exec jest src/common`
Expected: FAIL, "Cannot find module './valibot.pipe'".

- [ ] **Step 3: Implement**

```ts
// apps/api/src/common/valibot.pipe.ts
import {BadRequestException, type PipeTransform} from '@nestjs/common'
import * as v from 'valibot'

/** Validates a request part against a Valibot schema from @shop/shared (parent spec §5). */
export class ValibotPipe<S extends v.GenericSchema> implements PipeTransform<
  unknown,
  v.InferOutput<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): v.InferOutput<S> {
    const result = v.safeParse(this.schema, value)
    if (result.success) return result.output
    throw new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      issues: v.flatten(result.issues)
    })
  }
}
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @shop/api exec jest src/common && pnpm --filter @shop/api lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common
git commit -m "feat(api): ValibotPipe for request validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Catalog mapper

**Files:**

- Create: `apps/api/src/catalog/catalog.mapper.ts`
- Test: `apps/api/src/catalog/catalog.mapper.spec.ts`

**Interfaces:**

- Consumes: types and `ProductSectionSchema` from `@shop/shared/catalog`.
- Produces:
  - `type CatalogRows = {servers: ServerRow[]; products: ProductRow[]}` (shapes below; Task 7's Prisma `select` must return them)
  - `toCatalogResponse(rows: CatalogRows, locale: Locale, warn: (message: string) => void): CatalogResponse`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/catalog/catalog.mapper.spec.ts
import {type CatalogRows, toCatalogResponse} from './catalog.mapper'

const product = (overrides: Partial<CatalogRows['products'][number]> = {}) => ({
  slug: 'vip',
  kind: 'TIMED' as const,
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown' as const,
  server: {slug: 'survival'},
  category: {slug: 'ranks'},
  translations: [
    {locale: 'en' as const, name: 'VIP', description: 'EN text', sections: []},
    {
      locale: 'pl' as const,
      name: 'VIP',
      description: 'PL tekst',
      sections: [{title: 'Zestawy', entries: []}]
    }
  ],
  prices: [
    {currency: 'EUR' as const, amountMinor: 499},
    {currency: 'PLN' as const, amountMinor: 2199}
  ],
  ...overrides
})

const rows = (products = [product()]): CatalogRows => ({
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [
        {category: {slug: 'kits', translations: [{locale: 'en', name: 'Kits'}]}},
        {
          category: {
            slug: 'ranks',
            translations: [
              {locale: 'en', name: 'Ranks'},
              {locale: 'pl', name: 'Rangi'}
            ]
          }
        }
      ]
    }
  ],
  products
})

describe('toCatalogResponse', () => {
  it('uses the requested locale', () => {
    const res = toCatalogResponse(rows(), 'pl', jest.fn())
    expect(res.products[0]).toEqual({
      server: 'survival',
      category: 'ranks',
      slug: 'vip',
      kind: 'TIMED',
      durationDays: 30,
      mark: 'VIP',
      icon: 'crown',
      name: 'VIP',
      description: 'PL tekst',
      sections: [{title: 'Zestawy', entries: []}],
      prices: {EUR: 499, PLN: 2199}
    })
  })

  it('falls back to en for missing translations, keeping server category order', () => {
    const res = toCatalogResponse(rows(), 'pl', jest.fn())
    expect(res.servers[0]?.categories).toEqual([
      {slug: 'kits', name: 'Kits'},
      {slug: 'ranks', name: 'Rangi'}
    ])
  })

  it('omits and reports a product without text in the locale or en', () => {
    const warn = jest.fn()
    const orphan = product({
      slug: 'orphan',
      translations: [{locale: 'pl', name: 'X', description: 'Y', sections: []}]
    })
    const res = toCatalogResponse(rows([product(), orphan]), 'en', warn)
    expect(res.products.map(p => p.slug)).toEqual(['vip'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('survival/orphan'))
  })

  it('omits and reports a product missing a currency', () => {
    const warn = jest.fn()
    const noPln = product({prices: [{currency: 'EUR', amountMinor: 499}]})
    expect(toCatalogResponse(rows([noPln]), 'en', warn).products).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('price'))
  })

  it('never exposes commands or RCON fields', () => {
    const withSecrets = {
      ...product(),
      grantCommands: ['lp user {nick} parent add vip'],
      rconPasswordEnc: 'secret'
    }
    const json = JSON.stringify(toCatalogResponse(rows([withSecrets]), 'en', jest.fn()))
    expect(json).not.toMatch(/grantCommands|rcon|secret|parent add/)
  })

  it('throws on malformed sections instead of shipping them', () => {
    const bad = product({
      translations: [{locale: 'en', name: 'X', description: 'Y', sections: [{entries: 'nope'}]}]
    })
    expect(() => toCatalogResponse(rows([bad]), 'en', jest.fn())).toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/api exec jest src/catalog`
Expected: FAIL, "Cannot find module './catalog.mapper'".

- [ ] **Step 3: Implement**

```ts
// apps/api/src/catalog/catalog.mapper.ts
import * as v from 'valibot'

import {
  type CatalogProduct,
  type CatalogResponse,
  type Currency,
  type Locale,
  type ProductIcon,
  type ProductKind,
  ProductSectionSchema
} from '@shop/shared/catalog'

type Translated<T> = T & {locale: Locale}

/** What CatalogService selects; plain shapes so the mapper is testable without Prisma. */
export type CatalogRows = {
  servers: {
    slug: string
    name: string
    accent: string
    onAccent: string
    categories: {category: {slug: string; translations: Translated<{name: string}>[]}}[]
  }[]
  products: {
    slug: string
    kind: ProductKind
    durationDays: number | null
    mark: string
    icon: ProductIcon
    server: {slug: string}
    category: {slug: string}
    translations: Translated<{name: string; description: string; sections: unknown}>[]
    prices: {currency: Currency; amountMinor: number}[]
  }[]
}

const Sections = v.array(ProductSectionSchema)

function pick<T extends {locale: Locale}>(rows: T[], locale: Locale): T | undefined {
  return rows.find(r => r.locale === locale) ?? rows.find(r => r.locale === 'en')
}

/** Public catalog for `locale`: falls back to `en`, drops unsellable products (and says why), never leaks commands. */
export function toCatalogResponse(
  rows: CatalogRows,
  locale: Locale,
  warn: (message: string) => void
): CatalogResponse {
  const servers = rows.servers.map(s => ({
    slug: s.slug,
    name: s.name,
    accent: s.accent,
    onAccent: s.onAccent,
    categories: s.categories.flatMap(({category}) => {
      const text = pick(category.translations, locale)
      return text ? [{slug: category.slug, name: text.name}] : []
    })
  }))

  const products = rows.products.flatMap((p): CatalogProduct[] => {
    const id = `${p.server.slug}/${p.slug}`
    const text = pick(p.translations, locale)
    if (!text) {
      warn(`catalog: ${id} has no ${locale} or en text, skipped`)
      return []
    }
    const eur = p.prices.find(x => x.currency === 'EUR')
    const pln = p.prices.find(x => x.currency === 'PLN')
    if (!eur || !pln) {
      warn(`catalog: ${id} lacks a EUR or PLN price, skipped`)
      return []
    }
    return [
      {
        server: p.server.slug,
        category: p.category.slug,
        slug: p.slug,
        kind: p.kind,
        durationDays: p.durationDays,
        mark: p.mark,
        icon: p.icon,
        name: text.name,
        description: text.description,
        // Malformed JSON in the database fails the request (500, logged) rather than reaching the storefront.
        sections: v.parse(Sections, text.sections),
        prices: {EUR: eur.amountMinor, PLN: pln.amountMinor}
      }
    ]
  })

  return {servers, products}
}
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @shop/api exec jest src/catalog && pnpm --filter @shop/api lint`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/catalog
git commit -m "feat(api): catalog mapper with locale fallback and unsellable-product guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `GET /api/catalog`

**Files:**

- Create: `apps/api/src/catalog/catalog.service.ts`, `catalog.controller.ts`, `catalog.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/catalog.int-spec.ts`

**Interfaces:**

- Consumes: `PrismaService` (Task 3), `seedCatalog` (Task 4), `ValibotPipe` (Task 5), `toCatalogResponse`, `CatalogRows` (Task 6), `CatalogQuerySchema` (Task 2).
- Produces: `CatalogService.get(locale: Locale): Promise<CatalogResponse>`; route `GET /api/catalog?locale=`.

- [ ] **Step 1: Write the failing integration test**

```ts
// apps/api/test/catalog.int-spec.ts
import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'
import * as v from 'valibot'

import {CatalogResponseSchema} from '@shop/shared/catalog'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('GET /api/catalog', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication

  beforeAll(async () => {
    db = await startDatabase()
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
    await seedCatalog(app.get(PrismaService))
  })

  afterAll(async () => {
    await app.close()
    await db.stop()
  })

  it('returns the seeded catalog in Polish', async () => {
    const res = await request(app.getHttpServer()).get('/api/catalog?locale=pl').expect(200)
    const body = v.parse(CatalogResponseSchema, res.body)
    expect(body.servers.map(s => s.slug)).toEqual(['survival', 'anarchy', 'minigames'])
    expect(body.servers[1]?.categories.map(c => c.slug)).toEqual([
      'kits',
      'ranks',
      'cases',
      'currency'
    ])
    expect(body.servers[0]?.categories[0]?.name).toBe('Rangi')
    expect(body.products).toHaveLength(20)
    expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=60')
  })

  it('leaves out inactive products and products of inactive servers', async () => {
    const prisma = app.get(PrismaService)
    await prisma.product.updateMany({where: {slug: 'vip'}, data: {isActive: false}})
    await prisma.server.update({where: {slug: 'minigames'}, data: {isActive: false}})
    const res = await request(app.getHttpServer()).get('/api/catalog?locale=en').expect(200)
    const body = v.parse(CatalogResponseSchema, res.body)
    expect(body.products.some(p => p.slug === 'vip')).toBe(false)
    expect(body.products.some(p => p.server === 'minigames')).toBe(false)
    expect(body.servers.map(s => s.slug)).toEqual(['survival', 'anarchy'])
  })

  it.each(['', '?locale=PL', '?locale=de', '?locale=en&locale=pl'])(
    'returns 400 for "%s"',
    async query => {
      await request(app.getHttpServer()).get(`/api/catalog${query}`).expect(400)
    }
  )
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/api test:int`
Expected: FAIL on the catalog spec with 404 for `/api/catalog`.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/catalog/catalog.service.ts
import {Injectable, Logger} from '@nestjs/common'

import type {CatalogResponse, Locale} from '@shop/shared/catalog'

import {PrismaService} from '../prisma/prisma.service'
import {toCatalogResponse} from './catalog.mapper'

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name)

  constructor(private readonly prisma: PrismaService) {}

  async get(locale: Locale): Promise<CatalogResponse> {
    const texts = {where: {locale: {in: [locale, 'en' as const]}}}
    const [servers, products] = await Promise.all([
      this.prisma.server.findMany({
        where: {isActive: true},
        orderBy: [{sort: 'asc'}, {slug: 'asc'}],
        select: {
          slug: true,
          name: true,
          accent: true,
          onAccent: true,
          categories: {
            orderBy: {sort: 'asc'},
            select: {
              category: {
                select: {slug: true, translations: {...texts, select: {locale: true, name: true}}}
              }
            }
          }
        }
      }),
      this.prisma.product.findMany({
        where: {isActive: true, server: {isActive: true}},
        orderBy: [{sort: 'asc'}, {slug: 'asc'}],
        select: {
          slug: true,
          kind: true,
          durationDays: true,
          mark: true,
          icon: true,
          server: {select: {slug: true}},
          category: {select: {slug: true}},
          translations: {
            ...texts,
            select: {locale: true, name: true, description: true, sections: true}
          },
          prices: {select: {currency: true, amountMinor: true}}
        }
      })
    ])
    return toCatalogResponse({servers, products}, locale, message => {
      this.logger.warn(message)
    })
  }
}
```

```ts
// apps/api/src/catalog/catalog.controller.ts
import {Controller, Get, Header, Query} from '@nestjs/common'

import {type CatalogQuery, CatalogQuerySchema, type CatalogResponse} from '@shop/shared/catalog'

import {ValibotPipe} from '../common/valibot.pipe'
import {CatalogService} from './catalog.service'

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  // The web data cache does the real caching (60 s); a shared cache may hold it as long.
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60')
  get(@Query(new ValibotPipe(CatalogQuerySchema)) query: CatalogQuery): Promise<CatalogResponse> {
    return this.catalog.get(query.locale)
  }
}
```

```ts
// apps/api/src/catalog/catalog.module.ts
import {Module} from '@nestjs/common'

import {CatalogController} from './catalog.controller'
import {CatalogService} from './catalog.service'

@Module({controllers: [CatalogController], providers: [CatalogService]})
export class CatalogModule {}
```

Add `CatalogModule` to `AppModule.imports`.

Products are ordered by global `sort`, which the seed sets per server; the storefront groups by server, so cross-server order does not matter.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @shop/api test:int && pnpm --filter @shop/api test && pnpm --filter @shop/api lint && pnpm --filter @shop/api typecheck`
Expected: PASS. If TypeScript says the Prisma result is not assignable to `CatalogRows`, fix the `select`, not the mapper types.

- [ ] **Step 5: Try it locally**

Run: `pnpm --filter @shop/api dev` (another terminal), then `curl -s 'localhost:4000/api/catalog?locale=pl' | head -c 300`
Expected: JSON starting with `{"servers":[{"slug":"survival"`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test/catalog.int-spec.ts
git commit -m "feat(api): GET /api/catalog with locale validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Readiness check

**Files:**

- Modify: `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts` (only if it lists providers)
- Test: `apps/api/src/health/health.controller.spec.ts`

**Interfaces:**

- Consumes: `PrismaService`.
- Produces: `GET /api/health/ready` → `200 {status: 'ok', database: 'up'}` or `503 {status: 'error', database: 'down'}`.

A 10-line check replaces the spec's `@nestjs/terminus` suggestion: one probe does not justify the dependency. Note this in the spec (§4.3) in Task 16.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/health/health.controller.spec.ts
import {ServiceUnavailableException} from '@nestjs/common'

import type {PrismaService} from '../prisma/prisma.service'
import {HealthController} from './health.controller'

const controller = (queryRaw: () => Promise<unknown>) =>
  new HealthController({$queryRaw: queryRaw} as unknown as PrismaService)

describe('HealthController.ready', () => {
  it('reports the database up', async () => {
    await expect(controller(() => Promise.resolve([{ok: 1}])).ready()).resolves.toEqual({
      status: 'ok',
      database: 'up'
    })
  })

  it('returns 503 when the database is down', async () => {
    await expect(
      controller(() => Promise.reject(new Error('ECONNREFUSED'))).ready()
    ).rejects.toThrow(ServiceUnavailableException)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/api exec jest src/health`
Expected: FAIL ("ready is not a function" / constructor arity).

- [ ] **Step 3: Implement**

```ts
// apps/api/src/health/health.controller.ts
import {Controller, Get, ServiceUnavailableException} from '@nestjs/common'

import {PrismaService} from '../prisma/prisma.service'

export interface HealthResponse {
  status: 'ok'
  version: string
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process answers. Docker HEALTHCHECK uses this, so a database blip does not restart the API. */
  @Get()
  get(): HealthResponse {
    return {status: 'ok', version: process.env.APP_VERSION ?? 'dev'}
  }

  /** Readiness: the database answers too. */
  @Get('ready')
  async ready(): Promise<{status: 'ok'; database: 'up'}> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({status: 'error', database: 'down'})
    }
    return {status: 'ok', database: 'up'}
  }
}
```

- [ ] **Step 4: Run unit and e2e tests**

Run: `pnpm --filter @shop/api test && pnpm --filter @shop/api lint`
Expected: PASS (existing `/api/health` e2e still passes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health
git commit -m "feat(api): readiness check for the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: OpenAPI document and Swagger UI

**Files:**

- Create: `apps/api/src/openapi/openapi.ts`, `apps/api/src/openapi/write-openapi.ts`, `apps/api/openapi.json`
- Modify: `apps/api/src/configure-app.ts`, `apps/api/package.json`
- Test: `apps/api/src/openapi/openapi.spec.ts`, `apps/api/test/health.e2e-spec.ts` (add a docs check)

**Interfaces:**

- Consumes: `LocaleSchema`, `CatalogResponseSchema` (Task 2).
- Produces: `buildOpenApiDocument(): OpenApiDocument`; Swagger UI at `/api/docs`; committed `apps/api/openapi.json`; script `pnpm --filter @shop/api openapi`.

- [ ] **Step 1: Add dependencies**

`apps/api/package.json` dependencies: `"@nestjs/swagger": "^11.4.7"`, `"@valibot/to-json-schema": "^1.8.0"`. Scripts: `"openapi": "tsx src/openapi/write-openapi.ts"`. Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/openapi/openapi.spec.ts
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {buildOpenApiDocument} from './openapi'

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument()

  it('describes GET /api/catalog with a required locale', () => {
    const get = doc.paths['/api/catalog']?.get
    expect(get?.parameters).toEqual([
      expect.objectContaining({
        name: 'locale',
        in: 'query',
        required: true,
        schema: {enum: ['en', 'pl']}
      })
    ])
    expect(Object.keys(get?.responses ?? {})).toEqual(['200', '400'])
  })

  it('matches the committed openapi.json (run `pnpm --filter @shop/api openapi` after changing schemas)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(path.join(__dirname, '../../openapi.json'), 'utf8')
    )
    expect(committed).toEqual(doc)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @shop/api exec jest src/openapi`
Expected: FAIL, "Cannot find module './openapi'".

- [ ] **Step 4: Implement**

```ts
// apps/api/src/openapi/openapi.ts
import {toJsonSchema} from '@valibot/to-json-schema'
import type * as v from 'valibot'

import {CatalogResponseSchema, LocaleSchema} from '@shop/shared/catalog'

type JsonSchema = Record<string, unknown>

export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {title: string; version: string}
  paths: Record<
    string,
    {
      get?: {
        summary: string
        parameters: {name: string; in: 'query'; required: boolean; schema: JsonSchema}[]
        responses: Record<
          string,
          {description: string; content?: Record<string, {schema: JsonSchema}>}
        >
      }
    }
  >
}

/** JSON Schema of a Valibot schema without the top-level `$schema` key, which OpenAPI does not want inline. */
function schema(s: v.GenericSchema): JsonSchema {
  const {$schema: _ignored, ...rest} = toJsonSchema(s) as JsonSchema
  return rest
}

/** The API contract, generated from the same Valibot schemas the API validates with (parent spec §5). */
export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {title: 'Shop API', version: '1'},
    paths: {
      '/api/catalog': {
        get: {
          summary: 'Public catalog: servers with ordered categories, products with prices',
          parameters: [{name: 'locale', in: 'query', required: true, schema: schema(LocaleSchema)}],
          responses: {
            '200': {
              description: 'Catalog in the requested locale (missing texts fall back to en)',
              content: {'application/json': {schema: schema(CatalogResponseSchema)}}
            },
            '400': {description: 'Missing or unsupported locale'}
          }
        }
      }
    }
  }
}
```

If lint rejects the unused `_ignored` binding, use `delete` on a copy instead:

```ts
const json = {...(toJsonSchema(s) as JsonSchema)}
delete json.$schema
return json
```

```ts
// apps/api/src/openapi/write-openapi.ts
import {writeFileSync} from 'node:fs'
import path from 'node:path'

import {buildOpenApiDocument} from './openapi'

const file = path.join(__dirname, '../../openapi.json')
writeFileSync(file, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`)
console.log(`wrote ${file}`)
```

In `apps/api/src/configure-app.ts`:

```ts
import {INestApplication} from '@nestjs/common'
import {type OpenAPIObject, SwaggerModule} from '@nestjs/swagger'

import {buildOpenApiDocument} from './openapi/openapi'

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  // Swagger UI only renders the document; schemas come from @shop/shared, not from decorators.
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument() as unknown as OpenAPIObject)
}
```

Run: `pnpm --filter @shop/api openapi && pnpm exec prettier --write apps/api/openapi.json`

- [ ] **Step 5: Add an e2e check for the docs page** (append to `apps/api/test/health.e2e-spec.ts` inside its `describe`)

```ts
it('serves Swagger UI at /api/docs', async () => {
  const res = await request(app.getHttpServer()).get('/api/docs').expect(200)
  expect(res.text).toContain('swagger-ui')
})
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @shop/api test && pnpm --filter @shop/api lint && pnpm --filter @shop/api typecheck`
Expected: PASS. If the committed-file test fails only on formatting, compare after `JSON.parse` (it already does) — a real diff means the generator output changed: rerun the `openapi` script.

- [ ] **Step 7: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): OpenAPI document from shared schemas, Swagger UI at /api/docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Containers: migrate, seed, env

**Files:**

- Modify: `apps/api/Dockerfile`, `compose.e2e.yaml`
- Test: manual stack check (commands below)

**Interfaces:**

- Produces: e2e stack where `migrate` runs `prisma migrate deploy` and the seed before `api` starts; `api` has `DATABASE_URL`; `web` has `API_ORIGIN`.

- [ ] **Step 1: Ship Prisma files in the API image**

The `files` field (Task 3) makes `pnpm deploy` copy `prisma/`, `prisma.config.ts` and `src/prisma/database-url.ts`. In `apps/api/Dockerfile`, no change is needed for the build stage (turbo runs `generate` before `build`). Verify by building: `docker build -f apps/api/Dockerfile -t shop-api:local . && docker run --rm --entrypoint ls shop-api:local prisma dist/seed`
Expected: lists `migrations schema.prisma` and `main.js …`. If `prisma` is missing, add to the runner stage: `COPY --from=builder --chown=node:node /repo/apps/api/prisma ./prisma` and `COPY --from=builder --chown=node:node /repo/apps/api/prisma.config.ts ./`.

- [ ] **Step 2: Add the migrate service and env** in `compose.e2e.yaml`

```yaml
migrate:
  build:
    context: .
    dockerfile: apps/api/Dockerfile
    args: {APP_VERSION: e2e}
  command: ['sh', '-c', 'node_modules/.bin/prisma migrate deploy && node dist/seed/main.js']
  environment:
    DATABASE_URL: postgresql://shop:shop@postgres:5432/shop
  depends_on:
    postgres: {condition: service_healthy}
  healthcheck: {disable: true}

api:
  build:
    context: .
    dockerfile: apps/api/Dockerfile
    args: {APP_VERSION: e2e}
  environment:
    DATABASE_URL: postgresql://shop:shop@postgres:5432/shop
  depends_on:
    migrate: {condition: service_completed_successfully}

web:
  build:
    context: .
    dockerfile: apps/web/Dockerfile
  environment:
    API_ORIGIN: http://api:4000
  depends_on:
    api: {condition: service_healthy}
```

(Keep the existing `traefik` and `admin` entries.)

- [ ] **Step 3: Bring the stack up and check it**

Run:

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait
curl -s 'http://api.shop.localhost/api/catalog?locale=en' | head -c 120; echo
curl -s -o /dev/null -w '%{http_code}\n' http://api.shop.localhost/api/health/ready
```

Expected: JSON beginning `{"servers":[{"slug":"survival"`; `200`. (If `api.shop.localhost` is not routed by `infra/traefik/e2e.yml`, use `docker compose … exec api wget -qO- 'http://127.0.0.1:4000/api/catalog?locale=en'`.)

- [ ] **Step 4: Commit**

```bash
git add compose.e2e.yaml apps/api/Dockerfile
git commit -m "chore: migrate and seed before the API starts in the e2e stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Web: `getCatalog`, `CatalogProvider`, test fixture

**Files:**

- Modify: `apps/web/package.json` (add `"@shop/shared": "workspace:*"`)
- Create: `apps/web/src/features/catalog/api/get-catalog.ts`
- Create: `apps/web/src/features/catalog/catalog-provider.tsx`
- Create: `apps/web/src/features/catalog/test-catalog.tsx`
- Test: `apps/web/src/features/catalog/api/get-catalog.test.ts`, `apps/web/src/features/catalog/catalog-provider.test.tsx`

**Interfaces:**

- Consumes: `CatalogResponseSchema`, types from `@shop/shared/catalog`.
- Produces:
  - `getCatalog(locale: Locale): Promise<CatalogResponse>` (throws on failure)
  - `loadCatalog(locale: Locale): Promise<CatalogResponse | null>` (`null` on failure)
  - `CatalogProvider({catalog: CatalogResponse | null, children})`
  - `useCatalog(): {available: boolean; servers: CatalogServer[]; products: CatalogProduct[]; findServer(slug): CatalogServer | undefined; findProduct(server, slug): CatalogProduct | undefined; categoryName(slug): string}`
  - test-only: `TEST_CATALOG: CatalogResponse`, `renderWithCatalog(ui, catalog?)`

- [ ] **Step 1: Write the failing loader test**

```ts
// apps/web/src/features/catalog/api/get-catalog.test.ts
/** @jest-environment node */
import {TEST_CATALOG} from '@/features/catalog/test-catalog'

import {getCatalog, loadCatalog} from './get-catalog'

const respond = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), {status}))

afterEach(() => {
  jest.restoreAllMocks()
})

describe('getCatalog', () => {
  it('fetches the locale with a 60 s tagged cache and parses the body', async () => {
    const fetchMock = respond(200, TEST_CATALOG)
    await expect(getCatalog('pl')).resolves.toEqual(TEST_CATALOG)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/catalog?locale=pl', {
      next: {revalidate: 60, tags: ['catalog']}
    })
  })

  it('throws on an error status so the failure is not cached', async () => {
    respond(503, {})
    await expect(getCatalog('en')).rejects.toThrow('catalog 503')
  })

  it('throws on a malformed body', async () => {
    respond(200, {servers: 'nope'})
    await expect(getCatalog('en')).rejects.toThrow()
  })
})

describe('loadCatalog', () => {
  it('returns null instead of throwing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadCatalog('en')).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Write the fixture**

```tsx
// apps/web/src/features/catalog/test-catalog.tsx
// Test-only catalog in the API shape. Not imported by application code.
import {CatalogProvider} from '@/features/catalog/catalog-provider'
import {render} from '@testing-library/react'
import type {ReactElement} from 'react'

import type {CatalogResponse} from '@shop/shared/catalog'

export const TEST_CATALOG: CatalogResponse = {
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [
        {slug: 'ranks', name: 'Ranks'},
        {slug: 'cases', name: 'Cases'},
        {slug: 'currency', name: 'Currency'},
        {slug: 'kits', name: 'Kits'}
      ]
    },
    {
      slug: 'anarchy',
      name: 'Anarchy',
      accent: '#7b3ff2',
      onAccent: '#ffffff',
      categories: [
        {slug: 'kits', name: 'Kits'},
        {slug: 'ranks', name: 'Ranks'}
      ]
    },
    {
      slug: 'minigames',
      name: 'Minigames',
      accent: '#d92b52',
      onAccent: '#ffffff',
      categories: [
        {slug: 'ranks', name: 'Ranks'},
        {slug: 'cosmetics', name: 'Cosmetics'}
      ]
    }
  ],
  products: [
    {
      server: 'survival',
      category: 'ranks',
      slug: 'vip',
      kind: 'TIMED',
      durationDays: 30,
      mark: 'VIP',
      icon: 'crown',
      name: 'VIP',
      description: 'Coloured nickname, /hat, 2 extra homes and a VIP kit every 24 hours.',
      sections: [],
      prices: {EUR: 499, PLN: 2199}
    },
    {
      server: 'survival',
      category: 'ranks',
      slug: 'legend',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'LEGEND',
      icon: 'crown',
      name: 'Legend',
      description: 'Everything in Elite, plus particle trails.',
      sections: [
        {
          title: 'Kits',
          entries: [
            {cmd: '/kit legend', text: 'Diamond tools', cooldown: '24 h'},
            {text: 'Gold prefix'}
          ]
        }
      ],
      prices: {EUR: 1999, PLN: 8599}
    },
    {
      server: 'survival',
      category: 'cases',
      slug: 'mythic-case',
      kind: 'CASE',
      durationDays: null,
      mark: 'MYTHIC',
      icon: 'box',
      name: 'Mythic case',
      description: 'One key. Opens on the site with published odds.',
      sections: [],
      prices: {EUR: 249, PLN: 1099}
    },
    {
      server: 'anarchy',
      category: 'kits',
      slug: 'pvp-kit',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'PVP',
      icon: 'swords',
      name: 'PvP kit',
      description: 'Netherite sword and armour.',
      sections: [],
      prices: {EUR: 399, PLN: 1699}
    },
    {
      server: 'minigames',
      category: 'ranks',
      slug: 'pro',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'PRO',
      icon: 'crown',
      name: 'Pro',
      description: 'Double XP in every mode.',
      sections: [],
      prices: {EUR: 399, PLN: 1699}
    }
  ]
}

export const renderWithCatalog = (
  ui: ReactElement,
  catalog: CatalogResponse | null = TEST_CATALOG
) => render(<CatalogProvider catalog={catalog}>{ui}</CatalogProvider>)
```

- [ ] **Step 3: Write the failing provider test**

```tsx
// apps/web/src/features/catalog/catalog-provider.test.tsx
import {renderWithCatalog} from '@/features/catalog/test-catalog'
import {screen} from '@testing-library/react'

import {useCatalog} from './catalog-provider'

function Probe() {
  const {available, servers, findServer, findProduct, categoryName} = useCatalog()
  return (
    <p>
      {[
        String(available),
        String(servers.length),
        findServer('anarchy')?.name,
        findProduct('survival', 'vip')?.name,
        String(findProduct('anarchy', 'vip')),
        categoryName('cosmetics'),
        categoryName('unknown')
      ].join('|')}
    </p>
  )
}

describe('CatalogProvider', () => {
  it('looks up servers, products (per server) and category names', () => {
    renderWithCatalog(<Probe />)
    expect(screen.getByText('true|3|Anarchy|VIP|undefined|Cosmetics|unknown')).toBeInTheDocument()
  })

  it('is empty and unavailable without a catalog', () => {
    renderWithCatalog(<Probe />, null)
    expect(screen.getByText('false|0|||undefined|cosmetics|unknown')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm install && pnpm --filter @shop/web exec jest src/features/catalog/api src/features/catalog/catalog-provider.test.tsx`
Expected: FAIL, "Cannot find module './get-catalog'" / "'@/features/catalog/catalog-provider'".

- [ ] **Step 5: Implement**

```ts
// apps/web/src/features/catalog/api/get-catalog.ts
import type {Locale} from '@/i18n/routing'
import * as v from 'valibot'

import {type CatalogResponse, CatalogResponseSchema} from '@shop/shared/catalog'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

/** Public catalog for `locale`, cached by Next for 60 s per locale (ADR 0007). Throws on failure, so no error is cached. */
export async function getCatalog(locale: Locale): Promise<CatalogResponse> {
  const res = await fetch(`${API_ORIGIN}/api/catalog?locale=${locale}`, {
    next: {revalidate: 60, tags: ['catalog']}
  })
  if (!res.ok) throw new Error(`catalog ${String(res.status)}`)
  return v.parse(CatalogResponseSchema, await res.json())
}

/** For layouts and pages: `null` when the API cannot answer, so the shop renders as unavailable instead of a 500. */
export async function loadCatalog(locale: Locale): Promise<CatalogResponse | null> {
  try {
    return await getCatalog(locale)
  } catch (error) {
    console.error(error)
    return null
  }
}
```

```tsx
// apps/web/src/features/catalog/catalog-provider.tsx
'use client'

import {type ReactNode, createContext, use} from 'react'

import type {CatalogProduct, CatalogResponse, CatalogServer} from '@shop/shared/catalog'

type CatalogValue = {
  /** False when the API could not be reached and nothing was cached. */
  available: boolean
  servers: CatalogServer[]
  products: CatalogProduct[]
  findServer: (slug: string) => CatalogServer | undefined
  findProduct: (server: string, slug: string) => CatalogProduct | undefined
  categoryName: (slug: string) => string
}

const CatalogContext = createContext<CatalogValue | null>(null)

export function CatalogProvider({
  catalog,
  children
}: {
  catalog: CatalogResponse | null
  children: ReactNode
}) {
  const servers = catalog?.servers ?? []
  const products = catalog?.products ?? []
  const names = new Map(servers.flatMap(s => s.categories.map(c => [c.slug, c.name] as const)))
  const value: CatalogValue = {
    available: catalog !== null,
    servers,
    products,
    findServer: slug => servers.find(s => s.slug === slug),
    findProduct: (server, slug) => products.find(p => p.server === server && p.slug === slug),
    categoryName: slug => names.get(slug) ?? slug
  }
  return <CatalogContext value={value}>{children}</CatalogContext>
}

export function useCatalog(): CatalogValue {
  const value = use(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @shop/web exec jest src/features/catalog/api src/features/catalog/catalog-provider.test.tsx && pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): catalog loader and provider over the API contract

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Web: layout, pages, navbar, footer, live feed

**Files:**

- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/[locale]/[server]/page.tsx`
- Modify: `apps/web/src/app/[locale]/_components/home-view.tsx`, `navbar.tsx`, `footer.tsx`, `live-feed.tsx`
- Modify: `apps/web/src/app/[locale]/rules/page.tsx` (Footer prop)
- Test: `apps/web/src/app/[locale]/_components/live-feed.test.tsx`, `nav-links.test.tsx`/`mobile-menu.test.tsx` (wrap renders only if they render `Navbar`)

**Interfaces:**

- Consumes: `loadCatalog` (Task 11), `CatalogProvider`, `useCatalog`.
- Produces: `HomeView({server, settings, catalog}: {server: string; settings: SiteSettings; catalog: CatalogResponse | null})`; `Footer({settings, servers}: {settings: SiteSettings; servers: CatalogServer[]})`; `LiveFeed({catalog}: {catalog: CatalogResponse | null})`.

- [ ] **Step 1: Write the failing live-feed test change**

In `live-feed.test.tsx`, render `<LiveFeed catalog={TEST_CATALOG} />` (import `TEST_CATALOG` from `@/features/catalog/test-catalog`) wherever it renders `<LiveFeed />`, and add:

```tsx
it('shows only purchases whose product is still in the catalog', () => {
  render(<LiveFeed catalog={TEST_CATALOG} />)
  // Of the stub purchases, only vip, legend, mythic-case and pvp-kit exist in the fixture.
  expect(screen.queryByText(/champion/i)).toBeNull()
})

it('renders nothing without a catalog', () => {
  const {container} = render(<LiveFeed catalog={null} />)
  expect(container).toBeEmptyDOMElement()
})
```

Run: `pnpm --filter @shop/web exec jest src/app` → FAIL (type error / prop ignored).

- [ ] **Step 2: Live feed from props**

In `live-feed.tsx`: keep the stub list as raw rows (`server`, `slug`, `player`, `minutesAgo`, `id`) in `const STUB_ROWS = [...]` and replace the module-level `flatMap` with a function:

```tsx
function purchases(catalog: CatalogResponse) {
  return STUB_ROWS.flatMap(({server, slug, ...rest}) => {
    const product = catalog.products.find(p => p.server === server && p.slug === slug)
    const owner = catalog.servers.find(s => s.slug === server)
    return product && owner
      ? [{...rest, product, accent: owner.accent, onAccent: owner.onAccent}]
      : []
  })
}

type Purchase = ReturnType<typeof purchases>[number]
```

`LiveFeed` takes `{catalog}: {catalog: CatalogResponse | null}`, returns `null` when `catalog` is `null`, and uses `purchases(catalog)` where it used `STUB_PURCHASES`. Replace `p.product.price.EUR` with `p.product.prices.EUR`. Remove the `findProduct, findServer` import (keep `formatPrice` from `@/lib/catalog`).

- [ ] **Step 3: Layout provides the catalog**

In `layout.tsx` (after `await connection()` from Task 1):

```tsx
const catalog = await loadCatalog(locale)
```

with `import {loadCatalog} from '@/features/catalog/api/get-catalog'` and `import {CatalogProvider} from '@/features/catalog/catalog-provider'`, and wrap the providers:

```tsx
<NextIntlClientProvider messages={pickClientMessages(messages)}>
  <CatalogProvider catalog={catalog}>
    <StatusProvider>
      <ShopProvider>…unchanged…</ShopProvider>
    </StatusProvider>
  </CatalogProvider>
</NextIntlClientProvider>
```

`locale` must be typed `Locale` for `loadCatalog`: it already passed `hasLocale`, so `const catalog = await loadCatalog(locale)` type-checks after the `notFound()` guard.

- [ ] **Step 4: Pages**

`app/[locale]/page.tsx`:

```tsx
import {HomeView} from '@/app/[locale]/_components/home-view'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {type Locale} from '@/i18n/routing'

export default async function HomePage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params
  // Same fetch as the layout: Next dedupes it within the request.
  const [catalog, settings] = await Promise.all([loadCatalog(locale), getSiteSettings()])
  return <HomeView server={catalog?.servers[0]?.slug ?? ''} settings={settings} catalog={catalog} />
}
```

`app/[locale]/[server]/page.tsx`:

```tsx
import {HomeView} from '@/app/[locale]/_components/home-view'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {type Locale} from '@/i18n/routing'
import {notFound} from 'next/navigation'

export default async function ServerPage({
  params
}: {
  params: Promise<{locale: Locale; server: string}>
}) {
  const {locale, server} = await params
  const [catalog, settings] = await Promise.all([loadCatalog(locale), getSiteSettings()])
  // Without a catalog the slug cannot be checked: render the page with the shop marked unavailable.
  if (catalog && !catalog.servers.some(s => s.slug === server)) notFound()
  return <HomeView server={server} settings={settings} catalog={catalog} />
}
```

If Next's generated route types reject `Locale` in `params`, type it `{locale: string; …}` and narrow with `hasLocale(routing.locales, locale)` as `layout.tsx` does.

- [ ] **Step 5: HomeView, Footer, Navbar**

`home-view.tsx`: signature `HomeView({server, settings, catalog}: {server: string; settings: SiteSettings; catalog: CatalogResponse | null})`; render `<LiveFeed catalog={catalog} />` and `<Footer settings={settings} servers={catalog?.servers ?? []} />`.

`footer.tsx`: signature `Footer({settings, servers}: {settings: SiteSettings; servers: CatalogServer[]})`; delete `import {servers} from '@/config/servers'` (the prop replaces it); import `type CatalogServer` from `@shop/shared/catalog`.

`rules/page.tsx`: load the catalog for the footer: add `loadCatalog(locale)` to its `Promise.all` and render `<Footer settings={settings} servers={catalog?.servers ?? []} />`.

`navbar.tsx` (Client Component): replace `import {findServer} from '@/lib/catalog'` with `import {useCatalog} from '@/features/catalog/catalog-provider'`, add `const {findServer} = useCatalog()` at the top of `Navbar`; the existing `findServer(serverSlug)` call stays.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @shop/web test && pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck`
Expected: PASS. Any test that renders `Navbar` now needs `renderWithCatalog` instead of `render`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): layout, pages, navbar, footer and live feed read the catalog API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Web: catalog components

**Files:**

- Modify: `apps/web/src/features/catalog/components/catalog.tsx`, `product-card.tsx`, `product-detail.tsx`, `product-modal.tsx`, `product-plate.tsx`, `product-sections.tsx`, `product-icon.tsx`
- Modify: `apps/web/src/lib/catalog.ts`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/pl.json` (`catalog.unavailable`; remove category keys)
- Test: `catalog.test.tsx`, `product-card.test.tsx`, `product-detail.test.tsx`, `catalog-add-to-cart.test.tsx`

**Interfaces:**

- Consumes: `useCatalog`, `TEST_CATALOG`, `renderWithCatalog` (Task 11); `CatalogProduct`, `CatalogServer`, `ProductSection`, `ProductEntry`, `ProductIcon` types.
- Produces: components typed on `CatalogProduct` / `CatalogServer`; `lib/catalog.ts` exports only `productLayoutId`, `productPlateLayoutId`, `formatPrice`.

Field mapping used throughout (demo → API):

| Demo (`config/products`)                                             | API (`CatalogProduct`)                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `product.price[currency]`                                            | `product.prices[currency]`                                                                   |
| `product.description[locale]`                                        | `product.description`                                                                        |
| `product.sections?.[locale]`                                         | `product.sections`                                                                           |
| `product.adult`                                                      | `product.kind === 'CASE'`                                                                    |
| `product.durationDays` (number \| undefined)                         | `product.durationDays` (number \| null)                                                      |
| `t(product.category)` / `tc(product.category)`                       | `categoryName(product.category)` from `useCatalog()`                                         |
| `server.categories` (`CategoryId[]`)                                 | `server.categories.map(c => c.slug)`                                                         |
| `Product`, `Server`, `CategoryId`, `ProductIcon`, `Entry`, `Section` | `CatalogProduct`, `CatalogServer`, `string`, `ProductIcon`, `ProductEntry`, `ProductSection` |

- [ ] **Step 1: Write the failing tests**

1. `product-card.test.tsx` and `product-detail.test.tsx`: replace the `@/config/products` / `@/lib/catalog` imports with `import {TEST_CATALOG, renderWithCatalog} from '@/features/catalog/test-catalog'`; `const product = TEST_CATALOG.products[0] as CatalogProduct` (vip); `const server = TEST_CATALOG.servers[0] as CatalogServer`; replace each `render(` with `renderWithCatalog(`. Keep their existing providers (wrap order: `renderWithCatalog(<ShopProvider>…</ShopProvider>)`).
2. `catalog.test.tsx` and `catalog-add-to-cart.test.tsx`: replace `render(` with `renderWithCatalog(` and `products.find(p => p.server === 'survival')` with `TEST_CATALOG.products.find(p => p.server === 'survival')`; `renderToString(<Catalog … />)` becomes `renderToString(<CatalogProvider catalog={TEST_CATALOG}><Catalog … /></CatalogProvider>)`.
3. Add to `catalog.test.tsx`:

```tsx
it('shows the unavailable state without a catalog', () => {
  renderWithCatalog(<Catalog initialServer="survival" />, null)
  expect(screen.getByText('unavailable')).toBeInTheDocument()
})

it('labels category filters with names from the API', () => {
  renderWithCatalog(<Catalog initialServer="minigames" />)
  expect(screen.getAllByText('Cosmetics').length).toBeGreaterThan(0)
})
```

(These tests mock `next-intl` so translation keys render as-is: `'unavailable'` is the key.)

Run: `pnpm --filter @shop/web exec jest src/features/catalog` → FAIL (type errors and missing unavailable state).

- [ ] **Step 2: Switch `lib/catalog.ts`**

Delete `findServer`, `findProduct` and the `products`/`servers` imports; type the layout-id helpers on `CatalogProduct` (`import type {CatalogProduct} from '@shop/shared/catalog'`). `formatPrice` is unchanged.

- [ ] **Step 3: Switch the components**

- `product-icon.tsx`: `import type {ProductIcon as IconName} from '@shop/shared/catalog'`.
- `product-sections.tsx`: `import type {ProductEntry as Entry, ProductSection as Section} from '@shop/shared/catalog'`.
- `product-plate.tsx`, `product-modal.tsx`: types to `CatalogProduct` / `CatalogServer`; `product.adult` → `product.kind === 'CASE'`.
- `product-card.tsx`: type `CatalogProduct`; `const {categoryName} = useCatalog()`; `{t(product.category)}` → `{categoryName(product.category)}`; `product.price[currency]` → `product.prices[currency]`.
- `product-detail.tsx`: types; `const sections = product.sections`; `tc(product.category)` → `categoryName(product.category)` (via `useCatalog()`); `product.description[locale as Locale]` → `product.description`; `product.adult` → `product.kind === 'CASE'`; `product.price[currency]` → `product.prices[currency]`; drop the now-unused `Locale` import.
- `catalog.tsx`:
  1. Remove imports from `@/config/products`, `@/config/servers`, and `findServer` from `@/lib/catalog`; add `import {useCatalog} from '@/features/catalog/catalog-provider'` and `import type {CatalogProduct} from '@shop/shared/catalog'`.
  2. `type Filter = string` (a category slug or `'all'`).
  3. First line of `Catalog`: `const {available, servers, products, findServer, categoryName} = useCatalog()`.
  4. `useState<Product | null>` → `useState<CatalogProduct | null>`.
  5. `const server = findServer(serverSlug) ?? defaultServer` → `const server = findServer(serverSlug) ?? servers[0]`.
  6. `const filters: Filter[] = ['all', ...server.categories]` → `const filters: Filter[] = ['all', ...(server?.categories.map(c => c.slug) ?? [])]`.
  7. Where a filter label renders `{t(option)}` → `{option === 'all' ? t('all') : categoryName(option)}`.
  8. Right after the hooks (before any JSX uses `server`), add the unavailable branch:

```tsx
if (!available || !server)
  return (
    <section id="shop" className="max-w-page mx-auto px-[var(--gutter)] py-24">
      <p role="status" className="text-muted">
        {t('unavailable')}
      </p>
    </section>
  )
```

Hooks must stay above this `return` (React rules); move any hook that sits below the point where `server` is first used above it, and guard `useEffect(() => …, [server])` with `if (!server) return`.

- [ ] **Step 4: Messages**

In `apps/web/messages/en.json` → `catalog`: add `"unavailable": "The shop is temporarily unavailable. Please try again in a minute."` and remove `ranks`, `cases`, `currency`, `kits`, `cosmetics`. In `pl.json` → `catalog`: add `"unavailable": "Sklep jest chwilowo niedostępny. Spróbuj ponownie za minutę."` and remove the same five keys. Keep `days`, `forever`, `all`, `categories`.

Run: `grep -rn "t('ranks')\|t(\"ranks\")" apps/web/src` → no output.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @shop/web exec jest src/features/catalog src/i18n && pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): catalog components render API products and category names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Web: cart and checkout; remove demo files

**Files:**

- Modify: `apps/web/src/features/cart/shop-provider.tsx`, `features/cart/components/add-to-cart.tsx`, `features/cart/components/cart-menu.tsx`, `features/checkout/components/order-summary.tsx`
- Delete: `apps/web/src/config/products.ts`, `apps/web/src/config/servers.ts`
- Test: `shop-provider.test.tsx`, `cart-menu.test.tsx`, `checkout-modal.test.tsx`

**Interfaces:**

- Consumes: `useCatalog` (Task 11), `CatalogProduct`, `CatalogServer`.
- Produces: `ShopProvider` must be rendered inside `CatalogProvider` (layout already does, Task 12).

- [ ] **Step 1: Write the failing tests**

1. In the three tests, replace `import {products} from '@/config/products'` / `type Product` with `TEST_CATALOG` / `CatalogProduct`; `const [first] = products` → `const [first] = TEST_CATALOG.products`; replace `render(` with `renderWithCatalog(`.
2. Add to `shop-provider.test.tsx` (inside the saved-cart `describe`, using its `save` and render helpers):

```tsx
it('drops saved lines whose product is no longer in the catalog', () => {
  save([
    {server: 'survival', slug: 'vip', qty: 1},
    {server: 'survival', slug: 'removed-rank', qty: 2},
    {server: 'anarchy', slug: 'vip', qty: 1}
  ])
  setup()
  expect(screen.getByTestId('count')).toHaveTextContent('1')
})
```

Use the file's existing names for `save`, `setup` and the count probe; if the probe has another test id, assert on it.

Run: `pnpm --filter @shop/web exec jest src/features/cart src/features/checkout` → FAIL.

- [ ] **Step 2: Switch the files**

- `shop-provider.tsx`: `import type {CatalogProduct as Product} from '@shop/shared/catalog'`; replace `import {findProduct} from '@/lib/catalog'` with `import {useCatalog} from '@/features/catalog/catalog-provider'`; inside `ShopProvider` add `const {findProduct} = useCatalog()` and add `findProduct` to the `cartValue` `useMemo` dependency list (`[cart, findProduct]`).
- `add-to-cart.tsx`: `import type {CatalogProduct as Product} from '@shop/shared/catalog'`.
- `cart-menu.tsx`: `product.price[currency]` → `product.prices[currency]` (two places).
- `order-summary.tsx`: types to `CatalogProduct` / `CatalogServer`; `findServer` from `useCatalog()` (it is a Client Component; if not, take `servers` as a prop from its parent `CheckoutModal`); `price[currency]` → `prices[currency]` (two places).

- [ ] **Step 3: Delete the demo files**

Run: `git rm apps/web/src/config/products.ts apps/web/src/config/servers.ts && grep -rn "config/products\|config/servers\|defaultServer" apps/web/src`
Expected: no output.

- [ ] **Step 4: Run the whole web suite**

Run: `pnpm --filter @shop/web test && pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck && pnpm --filter @shop/web build`
Expected: PASS; the build succeeds with no API running.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "refactor(web): cart and checkout use the catalog API; drop demo catalog files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: End-to-end checks

**Files:**

- Create: `e2e/tests/catalog.spec.ts`

**Interfaces:**

- Consumes: the e2e stack from Task 10 (seeded database).

- [ ] **Step 1: Write the spec**

```ts
// e2e/tests/catalog.spec.ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

test('home shows seeded Survival products', async ({page}) => {
  await page.goto(`${WEB}/`)
  await expect(page.locator('#shop').getByText('VIP', {exact: true}).first()).toBeVisible()
})

test('server page shows that server, unknown server is 404', async ({page}) => {
  await page.goto(`${WEB}/anarchy`)
  await expect(page.locator('#shop').getByText('RAIDER').first()).toBeVisible()
  const res = await page.goto(`${WEB}/nether`)
  expect(res?.status()).toBe(404)
})

test('Polish page shows Polish category names from the database', async ({page}) => {
  await page.goto(`${WEB}/pl`)
  await expect(page.locator('#shop').getByText('Rangi').first()).toBeVisible()
})

test('a product opens in the modal with its price', async ({page}) => {
  await page.goto(`${WEB}/`)
  await page.locator('#shop').getByRole('button', {name: /VIP/}).first().click()
  await expect(page.getByRole('dialog')).toContainText('4.99')
})

test('a saved cart line for a product that no longer exists is dropped', async ({page}) => {
  await page.goto(`${WEB}/`)
  await page.evaluate(() => {
    localStorage.setItem(
      'cart',
      JSON.stringify([
        {server: 'survival', slug: 'vip', qty: 1},
        {server: 'survival', slug: 'gone-forever', qty: 3}
      ])
    )
  })
  await page.reload()
  await expect(page.getByRole('button', {name: /^Cart/})).toContainText('1')
})
```

Check `CART_STORAGE_KEY` in `apps/web/src/config/cart.ts` and use its value instead of `'cart'` if it differs; check the product card's accessible name in `product-card.tsx` and adjust `{name: /VIP/}` to it.

- [ ] **Step 2: Run it against the stack**

Run: `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm --filter @shop/e2e exec playwright test tests/catalog.spec.ts`
Expected: PASS on chromium and webkit.

- [ ] **Step 3: Run the full e2e suite**

Run: `pnpm --filter @shop/e2e test:e2e`
Expected: PASS (rules, smoke, navbar, modal, morph-popover).

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/catalog.spec.ts
git commit -m "test(e2e): storefront reads the seeded catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Parent spec and docs updates

**Files:**

- Modify: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`
- Modify: `docs/superpowers/specs/2026-10-09-data-catalog-design.md` (§4.3 readiness note)
- Modify: `CLAUDE.md` (one line)

- [ ] **Step 1: Update the parent spec** (data-catalog spec §9)

1. §2 decisions row 12 "Servers & catalog": replace "A product is offered per server with its own commands and prices." with "A product belongs to one server, with its own commands and prices; categories are global with a per-server order."
2. §6.2 Catalog: remove `product_offerings`; `products` gets `serverId`, `mark`, `icon`, `grantCommands text[]`, `revokeCommands text[]`, `sort` and a unique `(serverId, slug)`; `prices` references `productId`; add `server_categories(serverId, categoryId, sort)`; `servers` gets `accent`, `onAccent`; `product_translations` gets `sections jsonb`; `order_items.offeringId` → `productId`.
3. §8 item 3: "Catalog cache: the web data cache (60 s per locale), not Redis."
4. §15 row 2: "Prisma setup and catalog tables, migrations, seed, catalog API with translations, ValibotPipe, OpenAPI document + Swagger UI, contract checks"; row 3 gains "RTK Query codegen for admin".
5. §11.1: replace "ISR `revalidate: 60`" with "request-time rendering with a 60 s data cache (ADR 0007)".

- [ ] **Step 2: Data-catalog spec §4.3**

Replace "`@nestjs/terminus` Prisma check" with "a `SELECT 1` check in `HealthController` (one probe does not justify `@nestjs/terminus`)".

- [ ] **Step 3: CLAUDE.md**

Under "Architecture rules" add: `- Catalog data comes from \`GET /api/catalog\` (contract in \`@shop/shared\`); web reads it with \`getCatalog\`/\`useCatalog()\`, never from \`config/\`. Locale routes render at request time (ADR 0007).`

- [ ] **Step 4: Final gate and commit**

Run (repo root): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int && pnpm build`
Expected: all PASS.

```bash
git add docs CLAUDE.md
git commit -m "docs: align parent spec and CLAUDE.md with the catalog API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

---

## Done when

- `GET /api/catalog?locale=en|pl` serves the seeded catalog; bad locales get `400`; no secrets in responses.
- The storefront renders from the API in EN and PL with no visible change; `config/products.ts` and `config/servers.ts` are gone.
- `pnpm build` passes without the API; `pnpm test`, `pnpm test:int` and the e2e suite pass.
- `openapi.json` is committed and checked by a test; migrations are checked for drift by an integration test.
