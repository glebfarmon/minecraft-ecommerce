# Catalog Admin (Sub-project 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins manage servers, categories, products, prices, translations, game commands and display order from the admin app, and the storefront follows within a minute.

**Architecture:** A new NestJS module `catalog-admin` exposes REST routes under `/api/admin/catalog` through the existing `@AdminController` (session + TOTP + permission guard + audit interceptor). Request and response contracts are Valibot schemas in a new `@shop/shared/catalog-admin` entry, also used for the hand-built OpenAPI document; the admin app calls the API through RTK Query generated from `openapi.json` (stable hook names come from `operationId`s). Writes are optimistic-locked with a `version` column; reorders send the full id list and run in serializable transactions. RCON passwords are AES-256-GCM encrypted; the connection test resolves the host and refuses internal addresses.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), Valibot, `rcon-client`, Next.js 16 admin, RTK Query + `@rtk-query/codegen-openapi`, react-hook-form + Valibot, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Jest, Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-catalog-admin-design.md`

## Global Constraints

- Business logic only in `apps/api`; Next apps have no route handlers.
- NestJS global prefix `/api`; every catalog admin route is under `/api/admin/catalog` and declared with `@AdminController`.
- Money is `amountMinor: Int` + `currency`. Never floats. Prices in forms are decimal text converted with `toMinor` / `fromMinor`.
- Permissions: `catalog.write` (catalog writes, including order) and `server.rcon` (RCON address, password, test). Reads need only an admin session. `ADMIN` gets both, `SUPPORT` neither, `OWNER` always all.
- Slugs match `^[a-z0-9-]{1,40}$` (servers, products, categories).
- A new server or product is created disabled. An enabled product always has both prices (EUR, PLN) and both translations (en, pl).
- A product's `slug` and `serverId`, and a server's `slug`, change only while that record is disabled (`400 slug_locked`).
- `version` increments on every update of a row; reordering does not change it.
- Commands: one per line, at most 200 characters, the only placeholder is `{nick}`.
- RCON password: AES-256-GCM, key `RCON_ENCRYPTION_KEY` (32 bytes, base64); never returned by the API; redacted in audit rows. Without the key: `503 rcon_key_missing`.
- RCON hosts resolving to loopback, private, CGNAT, link-local, unique-local or multicast addresses are refused (`400 rcon_host_private`) unless `RCON_ALLOW_PRIVATE_HOSTS=true` (dev and tests only).
- RCON test: 5 s timeout, at most 5 per minute per session (`RATE_LIMIT_RCON_TEST`).
- Errors use the existing shape `{statusCode, message, issues?}`: `400` (`Validation failed`, `incomplete`, `slug_locked`, `slug_taken` is 409, `category_not_on_server`, `rcon_host_private`, `rcon_host_unresolvable`, `rcon_not_configured`), `404 not_found`, `409 stale`, `409 in_use` (counts in `issues`), `409 slug_taken`, `503 rcon_key_missing`.
- Every catalog operation in `openapi.ts` has `operationId`, `tags: ['Catalog admin']`, `summary`, `description` (what, which permission, storefront effect) and a description for every response.
- Storefront caching stays at 60 s; the admin says "Live on the site within a minute" after a save.
- Admin UI is EN only; forms follow ADR 0006 (react-hook-form + Valibot); shadcn components from `@shop/ui`.
- Do not bump ESLint (9) or TypeScript (6) majors. Never commit secrets; new env vars go to `.env.example`.
- TDD: failing test first. Before each commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (plus `pnpm test:int` for tasks that touch the database). Conventional Commits, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query` before grepping; `graphify update .` after editing code. Use Context7 before guessing a library API (dnd-kit: `/clauderic/dnd-kit`; rcon-client).

## Review Focus

1. **An enabled product loses a price or translation through `PATCH`** (the admin clears the PL tab and saves with "enabled" still ticked): the API must answer `400 incomplete` and keep the stored product unchanged, not save a half-empty live product. Pinned in Task 8.
2. **The RCON host is an internal address** (`127.0.0.1`, `10.0.0.5`, `postgres`, `::1`, `::ffff:10.0.0.5`): saving and testing must answer `400 rcon_host_private` and never open a socket. Pinned in Task 6 (unit, mapped IPv6) and Task 7 (route).
3. **Two admins reorder the same list** (the second still has the old list, or a product was added meanwhile): the second save is `409 stale` and nothing changes, rather than a list with a missing or duplicated `sort`. Pinned in Task 5 (servers) and Task 9 (products).
4. **A category is detached from a server that still sells products in it**: `409 in_use` with the count, and the storefront keeps the category. Pinned in Task 5.
5. **The audit log after an RCON change** must not contain the password or `rconPasswordEnc`, in `before` or `after`. Pinned in Task 3 (redact) and Task 7 (row read back from the database).

## File Structure

```
packages/shared/src/access.ts                 + catalog.write, server.rcon; ADMIN gets both
packages/shared/src/catalog-admin.ts          contracts, completeness, {nick} rule, toMinor/fromMinor
apps/api/prisma/schema.prisma                 + version on Server, Category, Product
apps/api/prisma/migrations/20261014100000_catalog_admin/            version columns, category slug check
apps/api/prisma/migrations/20261014100100_catalog_admin_permissions/ ADMIN role gains the new permissions
apps/api/src/common/http-errors.ts            notFound, conflict, badRequest, serviceUnavailable, stale, inUse
apps/api/src/audit/redact.ts                  + rconPasswordEnc
apps/api/src/catalog-admin/
  catalog-admin.module.ts
  versioned.ts                                assertUpdated (404 vs 409 stale)
  order.ts                                    assertSameSet, serializable()
  categories.service.ts / categories.controller.ts
  servers.mapper.ts / servers.service.ts / servers.controller.ts
  products.mapper.ts / products.service.ts / products.controller.ts
  rcon/rcon-crypto.ts                         encrypt / decrypt / key
  rcon/rcon-host.ts                           resolve + refuse internal addresses
  rcon/rcon-tester.ts                         RconTester interface + rcon-client implementation
  rcon/server-rcon.service.ts / rcon/server-rcon.controller.ts
apps/api/src/throttle/                        + rconTest throttler
apps/api/src/openapi/helpers.ts               shared builders moved out of openapi.ts
apps/api/src/openapi/catalog-admin-paths.ts   every catalog route, documented
apps/api/test/support/fake-rcon.ts            Source-RCON fake server
apps/api/test/support/catalog-app.ts          DB + Redis + seeded app for catalog suites
apps/api/test/catalog-*.int-spec.ts
packages/ui/src/textarea.tsx
apps/admin/src/lib/api/error-message.ts       apiErrorMessage moved from features/team, + catalog codes
apps/admin/src/features/catalog/
  lib/optimistic-order.ts                     useOptimisticOrder
  lib/product-form.ts                         form ⇄ API body
  schemas.ts                                  form schemas
  components/sortable-list.tsx                dnd-kit list (mouse, touch, keyboard)
  components/catalog-board.tsx                server tabs, categories, product cards
  components/categories-table.tsx
  components/product-editor.tsx, sections-editor.tsx
  components/server-editor.tsx, rcon-panel.tsx
apps/admin/src/app/(shell)/catalog/…          pages
e2e/tests/admin.spec.ts                       + catalog flow
```

---

### Task 1: Catalog admin contract in `@shop/shared`

**Files:**

- Modify: `packages/shared/src/access.ts`, `packages/shared/src/access.spec.ts`
- Create: `packages/shared/src/catalog-admin.ts`, `packages/shared/src/catalog-admin.spec.ts`
- Modify: `packages/shared/package.json` (export `./catalog-admin`)

**Interfaces:**

- Produces (all from `@shop/shared/catalog-admin`): `SLUG_PATTERN`, `hasOnlyNickPlaceholder(command: string): boolean`, `toMinor(text: string): number | null`, `fromMinor(minor: number): string`, `missingForActive(p): MissingField[]`, schemas `ServerCreateSchema`, `ServerUpdateSchema`, `AdminServerSchema`, `OrderInputSchema`, `ServerCategoriesInputSchema`, `RconInputSchema`, `RconTestResultSchema`, `CategoryInputSchema`, `CategoryUpdateSchema`, `AdminCategorySchema`, `ProductCreateSchema`, `ProductUpdateSchema`, `AdminProductSchema`, `AdminProductListItemSchema`, `ProductListQuerySchema`, `VersionQuerySchema`, and their `Infer…` types `ServerCreate`, `ServerUpdate`, `AdminServer`, `OrderInput`, `ServerCategoriesInput`, `RconInput`, `RconTestResult`, `CategoryInput`, `CategoryUpdate`, `AdminCategory`, `ProductCreate`, `ProductUpdate`, `AdminProduct`, `AdminProductListItem`, `ProductListQuery`, `MissingField`.
- Produces (`@shop/shared/access`): `PERMISSIONS` gains `'catalog.write'`, `'server.rcon'`.

- [ ] **Step 1: Write the failing tests**

`packages/shared/src/access.spec.ts`, change the ADMIN expectation:

```ts
expect(SYSTEM_ROLES.ADMIN).toEqual(['admin.invite', 'audit.read', 'catalog.write', 'server.rcon'])
```

and add:

```ts
it('lists the catalog permissions', () => {
  expect(PERMISSIONS).toEqual(expect.arrayContaining(['catalog.write', 'server.rcon']))
  expect(SYSTEM_ROLES.SUPPORT).toEqual([])
})
```

`packages/shared/src/catalog-admin.spec.ts`:

```ts
import * as v from 'valibot'

import {
  OrderInputSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  RconInputSchema,
  ServerCreateSchema,
  VersionQuerySchema,
  fromMinor,
  hasOnlyNickPlaceholder,
  missingForActive,
  toMinor
} from './catalog-admin'

const product = {
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'PERMANENT' as const,
  durationDays: null,
  mark: 'VIP',
  icon: 'crown' as const,
  grantCommands: ['lp user {nick} parent add vip'],
  revokeCommands: [],
  prices: {EUR: 499, PLN: null},
  translations: {en: {name: 'VIP', description: '', sections: []}, pl: null}
}

describe('toMinor / fromMinor', () => {
  it.each([
    ['9.99', 999],
    ['9', 900],
    ['9.9', 990],
    ['9,99', 999],
    [' 12.50 ', 1250]
  ])('%s → %d', (text, minor) => {
    expect(toMinor(text)).toBe(minor)
  })

  it.each(['', '9.999', '-1', 'abc', '1e3', '9.'])('refuses %p', text => {
    expect(toMinor(text)).toBeNull()
  })

  it('formats minor units with two decimals', () => {
    expect(fromMinor(999)).toBe('9.99')
    expect(fromMinor(1205)).toBe('12.05')
    expect(fromMinor(100)).toBe('1.00')
  })
})

describe('hasOnlyNickPlaceholder', () => {
  it('accepts {nick} and plain text', () => {
    expect(hasOnlyNickPlaceholder('give {nick} diamond 1')).toBe(true)
    expect(hasOnlyNickPlaceholder('say hello')).toBe(true)
  })

  it('refuses any other placeholder', () => {
    expect(hasOnlyNickPlaceholder('give {player} diamond')).toBe(false)
    expect(hasOnlyNickPlaceholder('op {nick} {}')).toBe(false)
  })
})

describe('missingForActive', () => {
  it('names each missing price and translation', () => {
    expect(missingForActive(product)).toEqual(['price.PLN', 'translation.pl'])
  })

  it('is empty for a complete product', () => {
    expect(
      missingForActive({
        prices: {EUR: 1, PLN: 1},
        translations: {en: product.translations.en, pl: product.translations.en}
      })
    ).toEqual([])
  })
})

describe('ProductCreateSchema', () => {
  it('accepts an incomplete draft', () => {
    expect(v.safeParse(ProductCreateSchema, product).success).toBe(true)
  })

  it('refuses a command with another placeholder', () => {
    const result = v.safeParse(ProductCreateSchema, {
      ...product,
      grantCommands: ['give {player} 1']
    })
    expect(result.success).toBe(false)
  })

  it('needs durationDays exactly for TIMED products', () => {
    expect(v.safeParse(ProductCreateSchema, {...product, kind: 'TIMED'}).success).toBe(false)
    expect(
      v.safeParse(ProductCreateSchema, {...product, kind: 'TIMED', durationDays: 30}).success
    ).toBe(true)
    expect(v.safeParse(ProductCreateSchema, {...product, durationDays: 30}).success).toBe(false)
  })

  it('refuses a slug the cart cookie cannot hold', () => {
    expect(v.safeParse(ProductCreateSchema, {...product, slug: 'VIP Rank'}).success).toBe(false)
  })

  it('refuses a float price', () => {
    expect(
      v.safeParse(ProductCreateSchema, {...product, prices: {EUR: 4.99, PLN: null}}).success
    ).toBe(false)
  })
})

describe('ProductUpdateSchema', () => {
  it('needs a version and isActive', () => {
    expect(v.safeParse(ProductUpdateSchema, product).success).toBe(false)
    expect(
      v.safeParse(ProductUpdateSchema, {...product, isActive: false, version: 1}).success
    ).toBe(true)
  })
})

describe('other inputs', () => {
  it('refuses duplicate ids in an order', () => {
    expect(v.safeParse(OrderInputSchema, {ids: ['a', 'a']}).success).toBe(false)
    expect(v.safeParse(OrderInputSchema, {ids: []}).success).toBe(false)
  })

  it('needs host and port together, and a password or clearPassword, not both', () => {
    expect(v.safeParse(RconInputSchema, {host: 'mc.example.com', port: null}).success).toBe(false)
    expect(
      v.safeParse(RconInputSchema, {
        host: 'mc.example.com',
        port: 25575,
        password: 'x',
        clearPassword: true
      }).success
    ).toBe(false)
    expect(
      v.safeParse(RconInputSchema, {host: 'mc.example.com', port: 25575, password: 'x'}).success
    ).toBe(true)
  })

  it('checks server colors', () => {
    const server = {slug: 'survival', name: 'Survival', accent: '#ff6b1a', onAccent: '#000000'}
    expect(v.safeParse(ServerCreateSchema, server).success).toBe(true)
    expect(v.safeParse(ServerCreateSchema, {...server, accent: 'orange'}).success).toBe(false)
  })

  it('reads the version from the query string', () => {
    expect(v.parse(VersionQuerySchema, {version: '3'})).toEqual({version: 3})
    expect(v.safeParse(VersionQuerySchema, {version: '0'}).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/shared test`
Expected: FAIL: `Cannot find module './catalog-admin'`, and the ADMIN expectation differs.

- [ ] **Step 3: Implement**

`packages/shared/src/access.ts`:

```ts
/** Every permission the admin API checks. Later sub-projects append theirs. */
export const PERMISSIONS = [
  'admin.invite',
  'role.write',
  'audit.read',
  'catalog.write',
  'server.rcon'
] as const
```

```ts
export const SYSTEM_ROLES: Record<SystemRoleName, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: ['admin.invite', 'audit.read', 'catalog.write', 'server.rcon'],
  SUPPORT: []
}
```

`packages/shared/src/catalog-admin.ts`:

```ts
import * as v from 'valibot'

import {
  CURRENCIES,
  type Currency,
  LOCALES,
  type Locale,
  PRODUCT_ICONS,
  PRODUCT_KINDS,
  ProductSectionSchema
} from './catalog'

/** Same rule as the `*_slug_format` checks in the database: slugs fit the cart cookie. */
export const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/

const Id = v.pipe(v.string(), v.minLength(1))
const IdList = v.pipe(
  v.array(Id),
  v.check(ids => new Set(ids).size === ids.length, 'An id appears twice')
)
const Slug = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, 'Use 1–40 lowercase letters, digits or dashes'),
  v.description('URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies.')
)
const Version = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.description('The version you read. If someone saved since, the write fails with 409 `stale`.')
)
const text = (max: number, what: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, `Enter ${what}`),
    v.maxLength(max, `Use at most ${String(max)} characters`)
  )
const Color = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-f]{6}$/i, 'Use a hex color like #ff6b1a'),
  v.description('Hex color, e.g. `#ff6b1a`')
)
const Minor = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(10_000_000),
  v.description('Price in minor units (cents or grosze): 999 means 9.99')
)

/** `{nick}` is the only placeholder the delivery worker fills in (parent spec: command injection). */
export const hasOnlyNickPlaceholder = (command: string): boolean =>
  [...command.matchAll(/\{([^{}]*)\}/g)].every(m => m[1] === 'nick')

const Command = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(200, 'Use at most 200 characters per command'),
  v.check(hasOnlyNickPlaceholder, 'Only the {nick} placeholder is allowed'),
  v.description('RCON command without a leading slash; `{nick}` becomes the buyer’s nickname')
)
const Commands = v.pipe(v.array(Command), v.maxLength(20))

/** "9.99" → 999. Accepts "9", "9.9", "9,99"; anything else (negative, 3 decimals, text) → null. */
export function toMinor(text: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** 999 → "9.99". */
export const fromMinor = (minor: number): string =>
  `${String(Math.floor(minor / 100))}.${String(minor % 100).padStart(2, '0')}`

export type MissingField = `price.${Currency}` | `translation.${Locale}`

/** What a product still lacks before it may be enabled (spec decision #5). */
export function missingForActive(p: {
  prices: Record<Currency, number | null>
  translations: Record<Locale, unknown>
}): MissingField[] {
  return [
    ...CURRENCIES.filter(c => p.prices[c] === null).map(c => `price.${c}` as const),
    ...LOCALES.filter(l => p.translations[l] === null).map(l => `translation.${l}` as const)
  ]
}

// Servers

const serverFields = {
  slug: Slug,
  name: text(40, 'a name'),
  accent: v.pipe(Color, v.description('Tab and button color on the storefront')),
  onAccent: v.pipe(Color, v.description('Text color on top of the accent'))
}
export const ServerCreateSchema = v.object(serverFields)
export const ServerUpdateSchema = v.object({
  ...serverFields,
  isActive: v.pipe(v.boolean(), v.description('Shown on the storefront')),
  version: Version
})

const CategoryRef = v.object({id: Id, slug: v.string(), name: v.string()})

export const AdminServerSchema = v.object({
  id: Id,
  slug: v.string(),
  name: v.string(),
  accent: v.string(),
  onAccent: v.string(),
  isActive: v.boolean(),
  sort: v.number(),
  version: v.number(),
  productCount: v.number(),
  categories: v.pipe(v.array(CategoryRef), v.description('Attached categories in display order')),
  rcon: v.pipe(
    v.nullable(v.object({host: v.nullable(v.string()), port: v.nullable(v.number())})),
    v.description('RCON address; null unless the viewer has `server.rcon`')
  ),
  rconPasswordSet: v.boolean()
})

export const OrderInputSchema = v.object({
  ids: v.pipe(
    IdList,
    v.minLength(1),
    v.description('Every id of the list, in the new order. A different set of ids is 409 `stale`.')
  )
})

export const ServerCategoriesInputSchema = v.object({
  categoryIds: v.pipe(
    IdList,
    v.description('Categories attached to the server, in display order; missing ones are detached')
  )
})

export const RconInputSchema = v.pipe(
  v.object({
    host: v.nullable(
      v.pipe(
        v.string(),
        v.trim(),
        v.minLength(1),
        v.maxLength(253),
        v.description('Public hostname or IP of the game server; internal addresses are refused')
      )
    ),
    port: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
    password: v.optional(
      v.pipe(
        v.string(),
        v.minLength(1),
        v.maxLength(200),
        v.description('New RCON password; omit to keep the stored one')
      )
    ),
    clearPassword: v.optional(
      v.pipe(v.boolean(), v.description('true removes the stored password'))
    )
  }),
  v.check(r => (r.host === null) === (r.port === null), 'Set host and port together'),
  v.check(
    r => !(r.password !== undefined && r.clearPassword === true),
    'Send a new password or clearPassword, not both'
  )
)

export const RconTestResultSchema = v.variant('ok', [
  v.object({ok: v.literal(true), ms: v.pipe(v.number(), v.description('Round trip in ms'))}),
  v.object({
    ok: v.literal(false),
    error: v.picklist(['timeout', 'unreachable', 'auth_failed', 'decrypt_failed'])
  })
])

// Categories

const Names = v.object({en: text(40, 'an English name'), pl: text(40, 'a Polish name')})
export const CategoryInputSchema = v.object({slug: Slug, names: Names})
export const CategoryUpdateSchema = v.object({slug: Slug, names: Names, version: Version})
export const AdminCategorySchema = v.object({
  id: Id,
  slug: v.string(),
  names: v.object({en: v.string(), pl: v.string()}),
  version: v.number(),
  productCount: v.number(),
  servers: v.array(v.object({id: Id, name: v.string()}))
})

// Products

const Translation = v.object({
  name: text(60, 'a name'),
  description: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
  sections: v.pipe(v.array(ProductSectionSchema), v.maxLength(20))
})
const productFields = {
  serverId: Id,
  categoryId: v.pipe(Id, v.description('Must be attached to the server')),
  slug: Slug,
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.pipe(
    v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3650))),
    v.description('Days until revoke commands run; required for TIMED, null otherwise')
  ),
  mark: v.pipe(text(12, 'a mark'), v.description('Short wordmark on the product tile')),
  icon: v.picklist(PRODUCT_ICONS),
  grantCommands: v.pipe(Commands, v.description('Run on the game server after payment')),
  revokeCommands: v.pipe(Commands, v.description('Run when a TIMED product expires')),
  prices: v.object({EUR: v.nullable(Minor), PLN: v.nullable(Minor)}),
  translations: v.object({en: v.nullable(Translation), pl: v.nullable(Translation)})
}
const DURATION_RULE = 'A TIMED product needs durationDays; other kinds must not have it'
const durationMatchesKind = (p: {kind: string; durationDays: number | null}) =>
  (p.kind === 'TIMED') === (p.durationDays !== null)

/** Created disabled (spec decision #5), so drafts may lack prices and translations. */
export const ProductCreateSchema = v.pipe(
  v.object(productFields),
  v.check(p => durationMatchesKind(p), DURATION_RULE)
)
export const ProductUpdateSchema = v.pipe(
  v.object({
    ...productFields,
    isActive: v.pipe(
      v.boolean(),
      v.description('Shown on the storefront; needs both prices and both translations')
    ),
    version: Version
  }),
  v.check(p => durationMatchesKind(p), DURATION_RULE)
)

const TranslationOut = v.object({
  name: v.string(),
  description: v.string(),
  sections: v.array(ProductSectionSchema)
})
const PricesOut = v.object({EUR: v.nullable(v.number()), PLN: v.nullable(v.number())})
const Missing = v.pipe(
  v.array(v.picklist(['price.EUR', 'price.PLN', 'translation.en', 'translation.pl'])),
  v.description('What the product lacks before it may be enabled')
)

export const AdminProductSchema = v.object({
  id: Id,
  version: v.number(),
  sort: v.number(),
  serverId: Id,
  categoryId: Id,
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.nullable(v.number()),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  isActive: v.boolean(),
  grantCommands: v.array(v.string()),
  revokeCommands: v.array(v.string()),
  prices: PricesOut,
  translations: v.object({en: v.nullable(TranslationOut), pl: v.nullable(TranslationOut)}),
  missing: Missing
})

export const AdminProductListItemSchema = v.object({
  id: Id,
  version: v.number(),
  sort: v.number(),
  serverId: Id,
  categoryId: Id,
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  name: v.pipe(v.string(), v.description('English name, or the slug while there is none')),
  isActive: v.boolean(),
  prices: PricesOut,
  missing: Missing
})

export const ProductListQuerySchema = v.object({
  serverId: v.optional(Id),
  categoryId: v.optional(Id)
})

export const VersionQuerySchema = v.object({
  version: v.pipe(v.string(), v.regex(/^[1-9]\d*$/), v.transform(Number))
})

export type ServerCreate = v.InferOutput<typeof ServerCreateSchema>
export type ServerUpdate = v.InferOutput<typeof ServerUpdateSchema>
export type AdminServer = v.InferOutput<typeof AdminServerSchema>
export type OrderInput = v.InferOutput<typeof OrderInputSchema>
export type ServerCategoriesInput = v.InferOutput<typeof ServerCategoriesInputSchema>
export type RconInput = v.InferOutput<typeof RconInputSchema>
export type RconTestResult = v.InferOutput<typeof RconTestResultSchema>
export type CategoryInput = v.InferOutput<typeof CategoryInputSchema>
export type CategoryUpdate = v.InferOutput<typeof CategoryUpdateSchema>
export type AdminCategory = v.InferOutput<typeof AdminCategorySchema>
export type ProductCreate = v.InferOutput<typeof ProductCreateSchema>
export type ProductUpdate = v.InferOutput<typeof ProductUpdateSchema>
export type AdminProduct = v.InferOutput<typeof AdminProductSchema>
export type AdminProductListItem = v.InferOutput<typeof AdminProductListItemSchema>
export type ProductListQuery = v.InferOutput<typeof ProductListQuerySchema>
```

If `Locale`/`Currency` are not exported as types from `./catalog`, they are (`export type Locale`, `export type Currency` exist there); keep the imports as written.

`packages/shared/package.json`, `exports`:

```json
"./catalog-admin": {
  "types": "./dist/catalog-admin.d.ts",
  "default": "./dist/catalog-admin.js"
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/shared test && pnpm --filter @shop/shared build`
Expected: PASS; `dist/catalog-admin.js` exists.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): catalog admin contract and catalog permissions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Version columns and the permission migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (`Server`, `Category`, `Product`)
- Create: `apps/api/prisma/migrations/20261014100000_catalog_admin/migration.sql`
- Create: `apps/api/prisma/migrations/20261014100100_catalog_admin_permissions/migration.sql`
- Create: `apps/api/test/catalog-schema.int-spec.ts`

**Interfaces:**

- Produces: `version Int @default(1)` on `Server`, `Category`, `Product` (Prisma client fields `version`); DB check `categories_slug_format`.

- [ ] **Step 1: Write the failing test**

`apps/api/test/catalog-schema.int-spec.ts`:

```ts
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {PrismaService} from '../src/prisma/prisma.service'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const PERMISSIONS_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261014100100_catalog_admin_permissions/migration.sql'),
  'utf8'
)

describe('catalog admin schema', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
  })
  afterAll(async () => {
    await prisma.$disconnect()
    await db.stop()
  })

  it('starts every catalog row at version 1', async () => {
    const server = await prisma.server.create({
      data: {slug: 'v1', name: 'V', accent: '#000000', onAccent: '#ffffff'}
    })
    const category = await prisma.category.create({data: {slug: 'v1'}})
    expect(server.version).toBe(1)
    expect(category.version).toBe(1)
  })

  it('refuses a category slug the storefront cannot use', async () => {
    await expect(prisma.category.create({data: {slug: 'Bad Slug'}})).rejects.toThrow()
  })

  it('gives an existing ADMIN role the catalog permissions once, and leaves other roles alone', async () => {
    await prisma.role.create({
      data: {name: 'ADMIN', isSystem: true, permissions: ['admin.invite', 'audit.read']}
    })
    await prisma.role.create({data: {name: 'Editor', isSystem: false, permissions: []}})
    await prisma.$executeRawUnsafe(PERMISSIONS_SQL)
    await prisma.$executeRawUnsafe(PERMISSIONS_SQL)
    const admin = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    expect([...admin.permissions].sort()).toEqual(
      ['admin.invite', 'audit.read', 'catalog.write', 'server.rcon'].sort()
    )
    const editor = await prisma.role.findUniqueOrThrow({where: {name: 'Editor'}})
    expect(editor.permissions).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @shop/api exec jest -c jest.int.config.ts test/catalog-schema.int-spec.ts` (use the config file name the `test:int` script uses; check `apps/api/package.json`)
Expected: FAIL: `version` does not exist / migration file not found.

- [ ] **Step 3: Implement**

In `schema.prisma` add `version Int @default(1)` to `Server`, `Category` and `Product` (after `sort` where present; after `slug` in `Category`).

`20261014100000_catalog_admin/migration.sql`:

```sql
-- Optimistic locking for admin edits (catalog-admin spec decision #7).
ALTER TABLE "servers" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "categories" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "products" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Same slug rule as servers and products (20261012120000_slug_format).
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{1,40}$');
```

`20261014100100_catalog_admin_permissions/migration.sql`:

```sql
-- The seed runs once in production, so an existing ADMIN role gets the 3b permissions here.
-- Idempotent: running it twice leaves one copy of each permission.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['catalog.write', 'server.rcon']::text[]) AS p
  ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
```

Run `pnpm --filter @shop/api exec prisma generate`.

- [ ] **Step 4: Run the test to verify it passes**

Run: the command from Step 2, then `pnpm --filter @shop/api typecheck`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/test/catalog-schema.int-spec.ts
git commit -m "feat(api): version columns for catalog rows and catalog permissions for ADMIN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared API helpers: errors, version check, reorder, redaction

**Files:**

- Create: `apps/api/src/common/http-errors.ts`, `apps/api/src/common/http-errors.spec.ts`
- Modify: `apps/api/src/team/errors.ts` (re-use `notFound`, `conflict`)
- Create: `apps/api/src/catalog-admin/versioned.ts`, `apps/api/src/catalog-admin/order.ts`, `apps/api/src/catalog-admin/order.spec.ts`, `apps/api/src/catalog-admin/versioned.spec.ts`
- Modify: `apps/api/src/audit/redact.ts`, `apps/api/src/audit/redact.spec.ts`

**Interfaces:**

- Produces: `notFound()`, `conflict(message, issues?)`, `badRequest(message, issues?)`, `serviceUnavailable(message)`, `stale()`, `inUse(counts: Record<string, number>)` from `common/http-errors`; `assertUpdated(count: number, exists: () => Promise<boolean>): Promise<void>`; `assertSameSet(current: readonly string[], requested: readonly string[]): void`; `serializable<T>(prisma: PrismaService, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>`; `isPrismaError(error: unknown, code: string): boolean`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/common/http-errors.spec.ts`:

```ts
import {badRequest, inUse, serviceUnavailable, stale} from './http-errors'

describe('http errors', () => {
  it('builds the API error shape', () => {
    expect(stale().getStatus()).toBe(409)
    expect(stale().getResponse()).toEqual({statusCode: 409, message: 'stale'})
    expect(inUse({products: 3}).getResponse()).toEqual({
      statusCode: 409,
      message: 'in_use',
      issues: {products: 3}
    })
    expect(badRequest('incomplete', {missing: ['price.PLN']}).getResponse()).toEqual({
      statusCode: 400,
      message: 'incomplete',
      issues: {missing: ['price.PLN']}
    })
    expect(serviceUnavailable('rcon_key_missing').getStatus()).toBe(503)
  })
})
```

`apps/api/src/catalog-admin/order.spec.ts`:

```ts
import {assertSameSet} from './order'

describe('assertSameSet', () => {
  it('accepts the same ids in another order', () => {
    expect(() => {
      assertSameSet(['a', 'b', 'c'], ['c', 'a', 'b'])
    }).not.toThrow()
  })

  it.each([
    [['a', 'b'], ['a']],
    [
      ['a', 'b'],
      ['a', 'b', 'c']
    ],
    [
      ['a', 'b'],
      ['a', 'x']
    ]
  ])('is 409 stale for %p → %p', (current, requested) => {
    expect(() => {
      assertSameSet(current, requested)
    }).toThrow(expect.objectContaining({status: 409}) as Error)
  })
})
```

`apps/api/src/catalog-admin/versioned.spec.ts`:

```ts
import {assertUpdated} from './versioned'

describe('assertUpdated', () => {
  it('passes when one row changed', async () => {
    await expect(assertUpdated(1, () => Promise.resolve(true))).resolves.toBeUndefined()
  })

  it('is 409 stale when the row exists with another version', async () => {
    await expect(assertUpdated(0, () => Promise.resolve(true))).rejects.toMatchObject({
      status: 409,
      response: {message: 'stale'}
    })
  })

  it('is 404 when the row is gone', async () => {
    await expect(assertUpdated(0, () => Promise.resolve(false))).rejects.toMatchObject({
      status: 404
    })
  })
})
```

Add to `apps/api/src/audit/redact.spec.ts`:

```ts
it('hides the encrypted RCON password', () => {
  expect(redact({rconHost: 'mc.example.com', rconPasswordEnc: 'v1:abc'})).toEqual({
    rconHost: 'mc.example.com',
    rconPasswordEnc: '[redacted]'
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/common/http-errors.spec.ts src/catalog-admin src/audit/redact.spec.ts`
Expected: FAIL: modules not found; redaction test fails.

- [ ] **Step 3: Implement**

`apps/api/src/common/http-errors.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'

/** The API's error bodies: `{statusCode, message, issues?}`; `message` is a stable code. */
export const notFound = () => new NotFoundException({statusCode: 404, message: 'not_found'})

export const conflict = (message: string, issues?: Record<string, unknown>) =>
  new ConflictException({statusCode: 409, message, ...(issues && {issues})})

export const badRequest = (message: string, issues?: Record<string, unknown>) =>
  new BadRequestException({statusCode: 400, message, ...(issues && {issues})})

export const serviceUnavailable = (message: string) =>
  new ServiceUnavailableException({statusCode: 503, message})

/** Someone saved first: the client's version or id list is out of date. */
export const stale = () => conflict('stale')

/** Delete or detach blocked by rows that still reference the record. */
export const inUse = (counts: Record<string, number>) => conflict('in_use', counts)
```

`apps/api/src/team/errors.ts`: delete the local `notFound` and `conflict` and add

```ts
export {conflict, notFound} from '../common/http-errors'
```

(remove `ConflictException`, `NotFoundException` from its `@nestjs/common` import).

`apps/api/src/catalog-admin/versioned.ts`:

```ts
import {notFound, stale} from '../common/http-errors'

/**
 * After `updateMany({where: {id, version}})`: one row means the write landed; none means the row
 * is gone (404) or someone saved a newer version first (409 `stale`).
 */
export async function assertUpdated(count: number, exists: () => Promise<boolean>): Promise<void> {
  if (count === 1) return
  throw (await exists()) ? stale() : notFound()
}
```

`apps/api/src/catalog-admin/order.ts`:

```ts
import {stale} from '../common/http-errors'
import {Prisma} from '../generated/prisma/client'
import type {PrismaService} from '../prisma/prisma.service'

export const isPrismaError = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

/** A reorder sends every id of the list; a different set means the client's list is out of date. */
export function assertSameSet(current: readonly string[], requested: readonly string[]): void {
  const known = new Set(current)
  if (known.size !== requested.length || requested.some(id => !known.has(id))) throw stale()
}

/**
 * Serializable, so two reorders (or a reorder and an insert) cannot interleave; Postgres aborts
 * the loser with a serialization failure (Prisma P2034), which the client sees as 409 `stale`.
 */
export function serializable<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma
    .$transaction(fn, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable})
    .catch((error: unknown) => {
      if (isPrismaError(error, 'P2034')) throw stale()
      throw error
    })
}
```

`apps/api/src/audit/redact.ts`: add `'rconPasswordEnc'` to `SECRET_KEYS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test`
Expected: PASS (team tests still pass with the re-exported errors).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): shared error helpers, version check and reorder guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Categories API

**Files:**

- Create: `apps/api/src/catalog-admin/categories.service.ts`, `apps/api/src/catalog-admin/categories.controller.ts`, `apps/api/src/catalog-admin/catalog-admin.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `CatalogAdminModule`)
- Create: `apps/api/test/support/catalog-app.ts`, `apps/api/test/catalog-categories.int-spec.ts`

**Interfaces:**

- Consumes: Task 1 schemas, Task 3 helpers.
- Produces: `CatalogAdminModule`; `startCatalogApp(): Promise<{app; prisma; stop}>`; routes `GET|POST /api/admin/catalog/categories`, `PATCH|DELETE /api/admin/catalog/categories/:id` (`DELETE ?version=N`, 204).

- [ ] **Step 1: Write the test support and the failing test**

`apps/api/test/support/catalog-app.ts`:

```ts
import type {Server} from 'node:http'

import type {INestApplication} from '@nestjs/common'

import {createApp} from '../../src/create-app'
import {getMailer} from '../../src/mailer/create-mailer'
import {PrismaService} from '../../src/prisma/prisma.service'
import {seedAccess} from '../../src/seed/seed-access'
import {seedCatalog} from '../../src/seed/seed-catalog'
import {signInAdmin} from './admin'
import {startDatabase} from './database'
import {relaxRateLimits} from './rate-limits'
import {startRedis} from './redis'

/** Postgres + Redis + the seeded demo catalog and system roles, behind the real app. */
export async function startCatalogApp() {
  const [db, redis] = await Promise.all([startDatabase(), startRedis()])
  const prisma = new PrismaService()
  await seedAccess(prisma, getMailer(), 'http://admin.test')
  await seedCatalog(prisma)
  relaxRateLimits()
  const app: INestApplication<Server> = await createApp()
  await app.init()
  let n = 0
  /** A signed-in admin with a fresh email; `permissions` creates a custom role first. */
  const admin = async (role: 'OWNER' | 'ADMIN' | 'SUPPORT' | {permissions: string[]}) => {
    n += 1
    const roleName = typeof role === 'string' ? role : `Custom${String(n)}`
    if (typeof role !== 'string')
      await prisma.role.create({data: {name: roleName, permissions: role.permissions}})
    return signInAdmin(app, prisma, `catalog${String(n)}@example.com`, roleName)
  }
  return {
    app,
    prisma,
    admin,
    stop: async () => {
      await app.close()
      await prisma.$disconnect()
      await Promise.all([db.stop(), redis.stop()])
    }
  }
}
```

`apps/api/test/catalog-categories.int-spec.ts`:

```ts
import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

describe('catalog categories API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const body = {slug: 'tools', names: {en: 'Tools', pl: 'Narzędzia'}}

  it('lists categories with names, servers and product counts for any admin', async () => {
    const support = await ctx.admin('SUPPORT')
    const res = await support.get('/api/admin/catalog/categories').expect(200)
    const ranks = (res.body as {slug: string}[]).find(c => c.slug === 'ranks')
    expect(ranks).toMatchObject({
      names: {en: 'Ranks', pl: 'Rangi'},
      version: 1,
      productCount: expect.any(Number) as number,
      servers: expect.arrayContaining([expect.objectContaining({name: 'Survival'})]) as unknown
    })
  })

  it('refuses writes without catalog.write', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.post('/api/admin/catalog/categories').send(body).expect(403)
  })

  it('creates, renames and deletes a category, auditing each step', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const created = await editor.post('/api/admin/catalog/categories').send(body).expect(201)
    const id = (created.body as {id: string}).id
    expect(created.body).toMatchObject({slug: 'tools', version: 1, productCount: 0, servers: []})

    const renamed = await editor
      .patch(`/api/admin/catalog/categories/${id}`)
      .send({...body, names: {en: 'Gear', pl: 'Sprzęt'}, version: 1})
      .expect(200)
    expect(renamed.body).toMatchObject({names: {en: 'Gear', pl: 'Sprzęt'}, version: 2})

    await editor
      .patch(`/api/admin/catalog/categories/${id}`)
      .send({...body, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })

    await editor.delete(`/api/admin/catalog/categories/${id}?version=2`).expect(204)
    const rows = await ctx.prisma.auditLog.findMany({where: {entityId: id}})
    expect(rows.map(r => r.action).sort()).toEqual(
      ['category.create', 'category.delete', 'category.update'].sort()
    )
  })

  it('answers 409 slug_taken for a duplicate slug', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    await editor
      .post('/api/admin/catalog/categories')
      .send({...body, slug: 'ranks'})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_taken'})
      })
  })

  it('will not delete a category that still has products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const ranks = await ctx.prisma.category.findUniqueOrThrow({where: {slug: 'ranks'}})
    const res = await editor
      .delete(`/api/admin/catalog/categories/${ranks.id}?version=${String(ranks.version)}`)
      .expect(409)
    expect(res.body).toMatchObject({
      message: 'in_use',
      issues: {products: expect.any(Number) as number}
    })
  })
})
```

Check the audit model name in `schema.prisma` (`AuditLog` → `prisma.auditLog`) and adjust if it differs.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @shop/api test:int -- test/catalog-categories.int-spec.ts`
Expected: FAIL: 404 on `/api/admin/catalog/categories`.

- [ ] **Step 3: Implement**

`apps/api/src/catalog-admin/categories.service.ts`:

```ts
import {Injectable} from '@nestjs/common'

import {LOCALES} from '@shop/shared/catalog'
import type {AdminCategory, CategoryInput, CategoryUpdate} from '@shop/shared/catalog-admin'

import {conflict, inUse, notFound, stale} from '../common/http-errors'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {isPrismaError} from './order'
import {assertUpdated} from './versioned'

const include = {
  translations: true,
  servers: {select: {server: {select: {id: true, name: true}}}},
  _count: {select: {products: true}}
} satisfies Prisma.CategoryInclude
type Row = Prisma.CategoryGetPayload<{include: typeof include}>

const toAdminCategory = (r: Row): AdminCategory => ({
  id: r.id,
  slug: r.slug,
  version: r.version,
  names: {
    en: r.translations.find(t => t.locale === 'en')?.name ?? r.slug,
    pl: r.translations.find(t => t.locale === 'pl')?.name ?? r.slug
  },
  productCount: r._count.products,
  servers: r.servers.map(s => s.server)
})

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({include, orderBy: {slug: 'asc'}})
    return rows.map(toAdminCategory)
  }

  async create(input: CategoryInput): Promise<AdminCategory> {
    const row = await this.prisma.category
      .create({
        data: {
          slug: input.slug,
          translations: {create: LOCALES.map(locale => ({locale, name: input.names[locale]}))}
        },
        include
      })
      .catch(slugTaken)
    return toAdminCategory(row)
  }

  async update(
    id: string,
    input: CategoryUpdate,
    before: (c: AdminCategory) => void
  ): Promise<AdminCategory> {
    const current = await this.prisma.category.findUnique({where: {id}, include})
    if (!current) throw notFound()
    before(toAdminCategory(current))
    const row = await this.prisma
      .$transaction(async tx => {
        const {count} = await tx.category.updateMany({
          where: {id, version: input.version},
          data: {slug: input.slug, version: {increment: 1}}
        })
        await assertUpdated(count, async () => (await tx.category.count({where: {id}})) > 0)
        for (const locale of LOCALES)
          await tx.categoryTranslation.upsert({
            where: {categoryId_locale: {categoryId: id, locale}},
            create: {categoryId: id, locale, name: input.names[locale]},
            update: {name: input.names[locale]}
          })
        return tx.category.findUniqueOrThrow({where: {id}, include})
      })
      .catch(slugTaken)
    return toAdminCategory(row)
  }

  async remove(id: string, version: number, before: (c: AdminCategory) => void): Promise<void> {
    const current = await this.prisma.category.findUnique({where: {id}, include})
    if (!current) throw notFound()
    const counts = {products: current._count.products, servers: current.servers.length}
    if (counts.products > 0 || counts.servers > 0) throw inUse(counts)
    before(toAdminCategory(current))
    const {count} = await this.prisma.category.deleteMany({where: {id, version}})
    if (count === 0) throw stale()
  }
}
```

`apps/api/src/catalog-admin/categories.controller.ts`:

```ts
import {Body, Delete, Get, HttpCode, Param, Patch, Post, Query, Req} from '@nestjs/common'

import {
  type AdminCategory,
  type CategoryInput,
  CategoryInputSchema,
  type CategoryUpdate,
  CategoryUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {CategoriesService} from './categories.service'

@AdminController('catalog/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(): Promise<AdminCategory[]> {
    return this.categories.list()
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited('category.create', 'category')
  create(@Body(new ValibotPipe(CategoryInputSchema)) body: CategoryInput): Promise<AdminCategory> {
    return this.categories.create(body)
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited('category.update', 'category')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(CategoryUpdateSchema)) body: CategoryUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminCategory> {
    return this.categories.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('category.delete', 'category')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.categories.remove(id, query.version, before => {
      req.auditBefore = before
    })
  }
}
```

`apps/api/src/catalog-admin/catalog-admin.module.ts`:

```ts
import {Module} from '@nestjs/common'

import {CategoriesController} from './categories.controller'
import {CategoriesService} from './categories.service'

/** Catalog management for the admin app (sub-project 3b). */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService]
})
export class CatalogAdminModule {}
```

Import `CatalogAdminModule` in `app.module.ts` next to `TeamModule`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test:int -- test/catalog-categories.int-spec.ts && pnpm --filter @shop/api test`
Expected: PASS; `admin-routes.spec.ts` still passes (the new controller uses `@AdminController`).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): catalog categories admin API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Servers API: CRUD, order, attached categories

**Files:**

- Create: `apps/api/src/catalog-admin/servers.mapper.ts`, `apps/api/src/catalog-admin/servers.service.ts`, `apps/api/src/catalog-admin/servers.controller.ts`
- Modify: `apps/api/src/catalog-admin/catalog-admin.module.ts`
- Create: `apps/api/test/catalog-servers.int-spec.ts`

**Interfaces:**

- Consumes: Task 1 server schemas; Task 3 helpers; `startCatalogApp`.
- Produces: `serverInclude`, `ServerRow`, `toAdminServer(row: ServerRow, withRcon: boolean): AdminServer` (used by Task 7); routes `GET|POST /servers`, `GET|PATCH|DELETE /servers/:id`, `PUT /servers/order`, `PUT /servers/:id/categories`.

- [ ] **Step 1: Write the failing test**

`apps/api/test/catalog-servers.int-spec.ts`:

```ts
import request from 'supertest'

import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

type ServerBody = {id: string; slug: string; version: number; categories: {id: string}[]}

describe('catalog servers API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const ids = async () =>
    (await ctx.prisma.server.findMany({orderBy: {sort: 'asc'}})).map(s => s.id)
  const storefrontServers = async () =>
    (
      (await request(ctx.app.getHttpServer()).get('/api/catalog?locale=en').expect(200)).body as {
        servers: {slug: string; categories: {slug: string}[]}[]
      }
    ).servers

  it('lists servers in order and hides RCON from admins without server.rcon', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const res = await editor.get('/api/admin/catalog/servers').expect(200)
    const list = res.body as (ServerBody & {rcon: unknown; productCount: number})[]
    expect(list.map(s => s.slug)).toEqual(['survival', 'anarchy', 'minigames'])
    expect(list[0]).toMatchObject({rcon: null, rconPasswordSet: false})
    expect(list[0]?.productCount).toBeGreaterThan(0)
    const owner = await ctx.admin('OWNER')
    const one = await owner.get(`/api/admin/catalog/servers/${list[0]?.id ?? ''}`).expect(200)
    expect(one.body).toMatchObject({rcon: {host: null, port: null}})
  })

  it('creates a disabled server at the end and updates it with a version', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const created = await editor
      .post('/api/admin/catalog/servers')
      .send({slug: 'skyblock', name: 'Skyblock', accent: '#2266ff', onAccent: '#ffffff'})
      .expect(201)
    const server = created.body as ServerBody & {isActive: boolean; sort: number}
    expect(server).toMatchObject({isActive: false, version: 1, categories: []})
    expect(server.sort).toBe(3)
    await editor
      .patch(`/api/admin/catalog/servers/${server.id}`)
      .send({
        slug: 'sky',
        name: 'Sky',
        accent: '#2266ff',
        onAccent: '#ffffff',
        isActive: false,
        version: 1
      })
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({slug: 'sky', version: 2})
      })
    await editor.delete(`/api/admin/catalog/servers/${server.id}?version=2`).expect(204)
  })

  it('locks the slug of an enabled server', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})
    await editor
      .patch(`/api/admin/catalog/servers/${survival.id}`)
      .send({
        slug: 'survival-2',
        name: survival.name,
        accent: survival.accent,
        onAccent: survival.onAccent,
        isActive: true,
        version: survival.version
      })
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
  })

  it('will not delete a server that has products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})
    await editor
      .delete(`/api/admin/catalog/servers/${survival.id}?version=${String(survival.version)}`)
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'in_use'})
      })
  })

  it('reorders servers and the storefront follows; a stale list is refused', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const before = await ids()
    const reversed = [...before].reverse()
    await editor.put('/api/admin/catalog/servers/order').send({ids: reversed}).expect(200)
    expect(await ids()).toEqual(reversed)
    expect((await storefrontServers()).map(s => s.slug)).toEqual([
      'minigames',
      'anarchy',
      'survival'
    ])
    await editor
      .put('/api/admin/catalog/servers/order')
      .send({ids: reversed.slice(1)})
      .expect(409)
    expect(await ids()).toEqual(reversed)
    await editor.put('/api/admin/catalog/servers/order').send({ids: before}).expect(200)
  })

  it('reorders and attaches categories, but will not detach one with products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({
      where: {slug: 'survival'},
      include: {categories: {orderBy: {sort: 'asc'}}}
    })
    const current = survival.categories.map(c => c.categoryId)
    const tools = await ctx.prisma.category.create({
      data: {
        slug: 'tools-s',
        translations: {
          create: [
            {locale: 'en', name: 'Tools'},
            {locale: 'pl', name: 'Narzędzia'}
          ]
        }
      }
    })
    const next = [tools.id, ...[...current].reverse()]
    const res = await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: next})
      .expect(200)
    expect((res.body as ServerBody).categories.map(c => c.id)).toEqual(next)
    expect((await storefrontServers()).find(s => s.slug === 'survival')?.categories[0]?.slug).toBe(
      'tools-s'
    )

    const blocked = await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: [tools.id]})
      .expect(409)
    expect(blocked.body).toMatchObject({
      message: 'in_use',
      issues: {products: expect.any(Number) as number}
    })

    await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: current})
      .expect(200)
  })

  it('refuses an unknown category', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({
      where: {slug: 'survival'},
      include: {categories: true}
    })
    await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: [...survival.categories.map(c => c.categoryId), 'nope']})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'unknown_category'})
      })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @shop/api test:int -- test/catalog-servers.int-spec.ts`
Expected: FAIL: 404 on `/api/admin/catalog/servers`.

- [ ] **Step 3: Implement**

`apps/api/src/catalog-admin/servers.mapper.ts`:

```ts
import type {AdminServer} from '@shop/shared/catalog-admin'

import type {Prisma} from '../generated/prisma/client'

export const serverInclude = {
  categories: {
    orderBy: {sort: 'asc'},
    select: {
      category: {
        select: {id: true, slug: true, translations: {where: {locale: 'en'}, select: {name: true}}}
      }
    }
  },
  _count: {select: {products: true}}
} satisfies Prisma.ServerInclude
export type ServerRow = Prisma.ServerGetPayload<{include: typeof serverInclude}>

/** `withRcon` only for viewers holding `server.rcon`; the password itself never leaves the API. */
export const toAdminServer = (r: ServerRow, withRcon: boolean): AdminServer => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  accent: r.accent,
  onAccent: r.onAccent,
  isActive: r.isActive,
  sort: r.sort,
  version: r.version,
  productCount: r._count.products,
  categories: r.categories.map(({category: c}) => ({
    id: c.id,
    slug: c.slug,
    name: c.translations[0]?.name ?? c.slug
  })),
  rcon: withRcon ? {host: r.rconHost, port: r.rconPort} : null,
  rconPasswordSet: r.rconPasswordEnc !== null
})
```

`apps/api/src/catalog-admin/servers.service.ts`:

```ts
import {Injectable} from '@nestjs/common'

import type {
  AdminServer,
  ServerCategoriesInput,
  ServerCreate,
  ServerUpdate
} from '@shop/shared/catalog-admin'

import {badRequest, conflict, inUse, notFound, stale} from '../common/http-errors'
import {PrismaService} from '../prisma/prisma.service'
import {assertSameSet, isPrismaError, serializable} from './order'
import {serverInclude, toAdminServer} from './servers.mapper'
import {assertUpdated} from './versioned'

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(withRcon: boolean): Promise<AdminServer[]> {
    const rows = await this.prisma.server.findMany({
      include: serverInclude,
      orderBy: [{sort: 'asc'}, {slug: 'asc'}]
    })
    return rows.map(r => toAdminServer(r, withRcon))
  }

  async get(id: string, withRcon: boolean): Promise<AdminServer> {
    const row = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!row) throw notFound()
    return toAdminServer(row, withRcon)
  }

  /** New servers start disabled and last in the tab order. */
  async create(input: ServerCreate, withRcon: boolean): Promise<AdminServer> {
    const {_max} = await this.prisma.server.aggregate({_max: {sort: true}})
    const row = await this.prisma.server
      .create({
        data: {...input, isActive: false, sort: (_max.sort ?? -1) + 1},
        include: serverInclude
      })
      .catch(slugTaken)
    return toAdminServer(row, withRcon)
  }

  async update(
    id: string,
    input: ServerUpdate,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    // The slug is in storefront URLs and cart cookies (spec decision #9).
    if (current.isActive && input.slug !== current.slug) throw badRequest('slug_locked')
    before(toAdminServer(current, withRcon))
    const {version, ...data} = input
    const {count} = await this.prisma.server
      .updateMany({where: {id, version}, data: {...data, version: {increment: 1}}})
      .catch(slugTaken)
    await assertUpdated(count, async () => (await this.prisma.server.count({where: {id}})) > 0)
    return this.get(id, withRcon)
  }

  async remove(
    id: string,
    version: number,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<void> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    if (current._count.products > 0) throw inUse({products: current._count.products})
    before(toAdminServer(current, withRcon))
    const {count} = await this.prisma.server.deleteMany({where: {id, version}})
    if (count === 0) throw stale()
  }

  async order(ids: string[], withRcon: boolean): Promise<AdminServer[]> {
    await serializable(this.prisma, async tx => {
      const current = await tx.server.findMany({select: {id: true}})
      assertSameSet(
        current.map(s => s.id),
        ids
      )
      for (const [sort, id] of ids.entries()) await tx.server.update({where: {id}, data: {sort}})
    })
    return this.list(withRcon)
  }

  /** Replaces the attached categories and their order; detaching one that still has products is 409. */
  async setCategories(
    id: string,
    input: ServerCategoriesInput,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    await serializable(this.prisma, async tx => {
      const current = await tx.server.findUnique({where: {id}, include: serverInclude})
      if (!current) throw notFound()
      before(toAdminServer(current, withRcon))
      const known = await tx.category.count({where: {id: {in: input.categoryIds}}})
      if (known !== input.categoryIds.length) throw badRequest('unknown_category')
      const detached = current.categories
        .map(c => c.category.id)
        .filter(cid => !input.categoryIds.includes(cid))
      const products = await tx.product.count({
        where: {serverId: id, categoryId: {in: detached}}
      })
      if (products > 0) throw inUse({products})
      await tx.serverCategory.deleteMany({where: {serverId: id}})
      await tx.serverCategory.createMany({
        data: input.categoryIds.map((categoryId, sort) => ({serverId: id, categoryId, sort}))
      })
    })
    return this.get(id, withRcon)
  }
}
```

`apps/api/src/catalog-admin/servers.controller.ts`:

```ts
import {Body, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req} from '@nestjs/common'

import {hasPermission} from '@shop/shared/access'
import {
  type AdminServer,
  OrderInputSchema,
  type ServerCategoriesInput,
  ServerCategoriesInputSchema,
  type ServerCreate,
  ServerCreateSchema,
  type ServerUpdate,
  ServerUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {ServersService} from './servers.service'

const withRcon = (req: AuditableRequest) => hasPermission(adminOf(req).permissions, 'server.rcon')

@AdminController('catalog/servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  list(@Req() req: AuditableRequest): Promise<AdminServer[]> {
    return this.servers.list(withRcon(req))
  }

  // Declared before ':id' routes so `order` is never read as an id.
  @Put('order')
  @RequirePermission('catalog.write')
  @Audited('server.order', 'server')
  order(
    @Body(new ValibotPipe(OrderInputSchema)) body: {ids: string[]},
    @Req() req: AuditableRequest
  ): Promise<AdminServer[]> {
    return this.servers.order(body.ids, withRcon(req))
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuditableRequest): Promise<AdminServer> {
    return this.servers.get(id, withRcon(req))
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited('server.create', 'server')
  create(
    @Body(new ValibotPipe(ServerCreateSchema)) body: ServerCreate,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.create(body, withRcon(req))
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited('server.update', 'server')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(ServerUpdateSchema)) body: ServerUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.update(id, body, withRcon(req), before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('server.delete', 'server')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.servers.remove(id, query.version, withRcon(req), before => {
      req.auditBefore = before
    })
  }

  @Put(':id/categories')
  @RequirePermission('catalog.write')
  @Audited('server.categories', 'server')
  setCategories(
    @Param('id') id: string,
    @Body(new ValibotPipe(ServerCategoriesInputSchema)) body: ServerCategoriesInput,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.setCategories(id, body, withRcon(req), before => {
      req.auditBefore = before
    })
  }
}
```

Register `ServersController` and `ServersService` in `CatalogAdminModule`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test:int -- test/catalog-servers.int-spec.ts && pnpm --filter @shop/api test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): catalog servers admin API with tab and category order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: RCON building blocks: encryption, host guard, connection tester

**Files:**

- Modify: `apps/api/package.json` (dependency `rcon-client`)
- Create: `apps/api/src/catalog-admin/rcon/rcon-crypto.ts`, `rcon-crypto.spec.ts`
- Create: `apps/api/src/catalog-admin/rcon/rcon-host.ts`, `rcon-host.spec.ts`
- Create: `apps/api/src/catalog-admin/rcon/rcon-tester.ts`, `rcon-tester.spec.ts`
- Create: `apps/api/test/support/fake-rcon.ts`

**Interfaces:**

- Produces: `RconKeyMissingError`, `rconKey(env?): Buffer`, `encryptRconPassword(plain, key): string`, `decryptRconPassword(stored, key): string`; `RconHostPrivateError`, `isPrivateAddress(ip: string): boolean`, `resolveRconHost(host: string, allowPrivate?: boolean): Promise<string>`; `RCON_TESTER` (injection token), `RconTester` (`test(target: RconTarget, timeoutMs: number): Promise<RconTestResult>`), `RconTarget = {host: string; port: number; password: string}`, `RconClientTester`; `startFakeRcon(password: string): Promise<{port: number; commands: string[]; stop(): Promise<void>}>`.

- [ ] **Step 1: Check the library API**

Run Context7 for `rcon-client` (`Rcon.connect` options, `send`, `end`, the auth-failure error). Expected API: `Rcon.connect({host, port, password, timeout})`, `rcon.send(command): Promise<string>`, `rcon.end(): Promise<void>`. Install: `pnpm --filter @shop/api add rcon-client`.

- [ ] **Step 2: Write the failing tests**

`apps/api/test/support/fake-rcon.ts`:

```ts
import {type AddressInfo, type Socket, createServer} from 'node:net'

/** One Source-RCON packet: size, id, type, body, two NUL bytes. */
const packet = (id: number, type: number, body: string): Buffer => {
  const payload = Buffer.from(body, 'utf8')
  const buf = Buffer.alloc(14 + payload.length)
  buf.writeInt32LE(10 + payload.length, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  payload.copy(buf, 12)
  return buf
}

/** A Minecraft-like RCON server on 127.0.0.1 that accepts `password` and answers every command. */
export async function startFakeRcon(password: string) {
  const commands: string[] = []
  const sockets = new Set<Socket>()
  const server = createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => undefined)
    let pending = Buffer.alloc(0)
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk])
      while (pending.length >= 4) {
        const size = pending.readInt32LE(0)
        if (pending.length < 4 + size) break
        const id = pending.readInt32LE(4)
        const type = pending.readInt32LE(8)
        const body = pending.subarray(12, 4 + size - 2).toString('utf8')
        pending = pending.subarray(4 + size)
        if (type === 3) socket.write(packet(body === password ? id : -1, 2, ''))
        else if (type === 2) {
          commands.push(body)
          socket.write(packet(id, 0, 'There are 0 of a max of 20 players online:'))
        }
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    port: (server.address() as AddressInfo).port,
    commands,
    stop: () =>
      new Promise<void>(resolve => {
        for (const s of sockets) s.destroy()
        server.close(() => {
          resolve()
        })
      })
  }
}
```

`rcon-crypto.spec.ts`:

```ts
import {randomBytes} from 'node:crypto'

import {RconKeyMissingError, decryptRconPassword, encryptRconPassword, rconKey} from './rcon-crypto'

const key = randomBytes(32)

describe('RCON password encryption', () => {
  it('round-trips and never stores the plain text', () => {
    const stored = encryptRconPassword('hunter2', key)
    expect(stored).not.toContain('hunter2')
    expect(stored.startsWith('v1:')).toBe(true)
    expect(decryptRconPassword(stored, key)).toBe('hunter2')
  })

  it('uses a fresh IV each time', () => {
    expect(encryptRconPassword('same', key)).not.toBe(encryptRconPassword('same', key))
  })

  it('refuses a tampered value or another key', () => {
    const stored = encryptRconPassword('hunter2', key)
    const parts = stored.split(':')
    parts[3] = Buffer.from('xxxxxxx').toString('base64')
    expect(() => decryptRconPassword(parts.join(':'), key)).toThrow()
    expect(() => decryptRconPassword(stored, randomBytes(32))).toThrow()
  })

  it('reads a 32-byte base64 key and refuses a missing or short one', () => {
    expect(rconKey({RCON_ENCRYPTION_KEY: key.toString('base64')})).toEqual(key)
    expect(() => rconKey({})).toThrow(RconKeyMissingError)
    expect(() => rconKey({RCON_ENCRYPTION_KEY: randomBytes(16).toString('base64')})).toThrow(
      RconKeyMissingError
    )
  })
})
```

`rcon-host.spec.ts`:

```ts
import {RconHostPrivateError, isPrivateAddress, resolveRconHost} from './rcon-host'

describe('RCON host guard', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.20.1.1',
    '192.168.1.10',
    '100.64.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.5',
    '::ffff:127.0.0.1'
  ])('treats %s as internal', ip => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each(['1.1.1.1', '95.217.1.1', '2a01:4f8::1'])('treats %s as public', ip => {
    expect(isPrivateAddress(ip)).toBe(false)
  })

  it('refuses a name that resolves to loopback unless private hosts are allowed', async () => {
    await expect(resolveRconHost('localhost', false)).rejects.toBeInstanceOf(RconHostPrivateError)
    await expect(resolveRconHost('localhost', true)).resolves.toMatch(/^(127\.0\.0\.1|::1)$/)
  })

  it('returns a literal public IP as is', async () => {
    await expect(resolveRconHost('1.1.1.1', false)).resolves.toBe('1.1.1.1')
  })
})
```

`rcon-tester.spec.ts`:

```ts
import {startFakeRcon} from '../../../test/support/fake-rcon'
import {RconClientTester} from './rcon-tester'

describe('RconClientTester', () => {
  let fake: Awaited<ReturnType<typeof startFakeRcon>>
  const tester = new RconClientTester()

  beforeAll(async () => {
    fake = await startFakeRcon('secret')
  })
  afterAll(async () => {
    await fake.stop()
  })

  it('signs in and runs `list`', async () => {
    const result = await tester.test({host: '127.0.0.1', port: fake.port, password: 'secret'}, 5000)
    expect(result).toEqual({ok: true, ms: expect.any(Number) as number})
    expect(fake.commands).toContain('list')
  })

  it('reports a wrong password', async () => {
    await expect(
      tester.test({host: '127.0.0.1', port: fake.port, password: 'wrong'}, 5000)
    ).resolves.toEqual({ok: false, error: 'auth_failed'})
  })

  it('reports a closed port', async () => {
    await expect(
      tester.test({host: '127.0.0.1', port: 1, password: 'secret'}, 5000)
    ).resolves.toEqual({ok: false, error: 'unreachable'})
  })

  it('gives up after the timeout', async () => {
    // TEST-NET-1 is never routed, so the connect hangs until our timeout.
    const result = await tester.test({host: '192.0.2.1', port: 25575, password: 'x'}, 300)
    expect(result).toEqual({ok: false, error: 'timeout'})
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/catalog-admin/rcon`
Expected: FAIL: modules not found.

- [ ] **Step 4: Implement**

`rcon-crypto.ts`:

```ts
import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'

/** `RCON_ENCRYPTION_KEY` is absent or not 32 bytes: RCON writes and tests answer 503. */
export class RconKeyMissingError extends Error {}

export function rconKey(env: Partial<Record<string, string>> = process.env): Buffer {
  const raw = env.RCON_ENCRYPTION_KEY
  if (!raw) throw new RconKeyMissingError('RCON_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32)
    throw new RconKeyMissingError('RCON_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  return key
}

/** AES-256-GCM with a fresh 12-byte IV: `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export function encryptRconPassword(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data]
    .map(p => (typeof p === 'string' ? p : p.toString('base64')))
    .join(':')
}

/** Throws on a wrong key or a modified value (GCM authentication). */
export function decryptRconPassword(stored: string, key: Buffer): string {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('unknown RCON password format')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8'
  )
}
```

`rcon-host.ts`:

```ts
import {lookup} from 'node:dns/promises'
import {BlockList, isIP} from 'node:net'

/** The admin picked an address inside our network (spec decision #13). */
export class RconHostPrivateError extends Error {}

const internal = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  internal.addSubnet(net, prefix, 'ipv4')
internal.addAddress('::', 'ipv6')
internal.addAddress('::1', 'ipv6')
internal.addSubnet('fc00::', 7, 'ipv6')
internal.addSubnet('fe80::', 10, 'ipv6')
internal.addSubnet('ff00::', 8, 'ipv6')

/** Loopback, private, CGNAT, link-local, unique-local or multicast; IPv4-mapped IPv6 included. */
export function isPrivateAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1]
  if (mapped) return internal.check(mapped, 'ipv4')
  return internal.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4')
}

/**
 * The address to connect to. Every address the name resolves to must be public, and the caller
 * connects to the returned IP, so a second lookup cannot swap in an internal one.
 */
export async function resolveRconHost(
  host: string,
  allowPrivate = process.env.RCON_ALLOW_PRIVATE_HOSTS === 'true'
): Promise<string> {
  const addresses = isIP(host) ? [{address: host}] : await lookup(host, {all: true})
  const first = addresses[0]?.address
  if (!first) throw new Error(`no address for ${host}`)
  if (!allowPrivate && addresses.some(a => isPrivateAddress(a.address)))
    throw new RconHostPrivateError(host)
  return first
}
```

`rcon-tester.ts`:

```ts
import {Rcon} from 'rcon-client'

import type {RconTestResult} from '@shop/shared/catalog-admin'

export type RconTarget = {host: string; port: number; password: string}

/** Swappable in tests; the app binds `RconClientTester`. */
export interface RconTester {
  test(target: RconTarget, timeoutMs: number): Promise<RconTestResult>
}
export const RCON_TESTER = Symbol('RCON_TESTER')

const failure = (error: unknown): Extract<RconTestResult, {ok: false}>['error'] => {
  const message = error instanceof Error ? error.message : ''
  if (/auth/i.test(message)) return 'auth_failed'
  if (/timeout|timed out/i.test(message)) return 'timeout'
  return 'unreachable'
}

/** Signs in and runs `list`; never throws, so a bad target is a result, not a 5xx. */
export class RconClientTester implements RconTester {
  async test(target: RconTarget, timeoutMs: number): Promise<RconTestResult> {
    const started = performance.now()
    let timer: NodeJS.Timeout | undefined
    let rcon: Rcon | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout'))
      }, timeoutMs)
    })
    try {
      // rcon-client's own timeout covers replies, not a connect that hangs; the race covers both.
      rcon = await Promise.race([Rcon.connect({...target, timeout: timeoutMs}), deadline])
      await Promise.race([rcon.send('list'), deadline])
      return {ok: true, ms: Math.round(performance.now() - started)}
    } catch (error) {
      return {ok: false, error: failure(error)}
    } finally {
      clearTimeout(timer)
      await rcon?.end().catch(() => undefined)
    }
  }
}
```

If rcon-client's auth-failure message does not contain "auth" (check in Step 1), match its actual message in `failure`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api exec jest src/catalog-admin/rcon && pnpm --filter @shop/api test`
Expected: PASS. If the timeout test is slow or flaky on a network that answers TEST-NET with ICMP (giving `unreachable`), accept either `timeout` or `unreachable` there and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): rcon password encryption, internal-host guard and connection tester

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: RCON routes and their rate limit

**Files:**

- Create: `apps/api/src/catalog-admin/rcon/server-rcon.service.ts`, `apps/api/src/catalog-admin/rcon/server-rcon.controller.ts`
- Modify: `apps/api/src/catalog-admin/catalog-admin.module.ts`
- Modify: `apps/api/src/throttle/rate-limits.ts`, `apps/api/src/throttle/rate-limits.spec.ts`, `apps/api/src/throttle/throttle.module.ts`
- Create: `apps/api/test/catalog-rcon.int-spec.ts`

**Interfaces:**

- Consumes: Task 5 `serverInclude`, `toAdminServer`; Task 6 crypto, host guard, `RCON_TESTER`, `RconClientTester`; `startFakeRcon`.
- Produces: `PUT /api/admin/catalog/servers/:id/rcon` → `AdminServer`; `POST /api/admin/catalog/servers/:id/rcon/test` → `RconTestResult` (200); throttler `rconTest` (`RATE_LIMIT_RCON_TEST`, default 5 per minute per session).

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/throttle/rate-limits.spec.ts`:

```ts
it('limits RCON tests to 5 per minute by default and reads RATE_LIMIT_RCON_TEST', () => {
  expect(rateLimits({}).rconTest).toBe(5)
  expect(rateLimits({RATE_LIMIT_RCON_TEST: '2'}).rconTest).toBe(2)
})
```

`apps/api/test/catalog-rcon.int-spec.ts`:

```ts
import {randomBytes} from 'node:crypto'

import {startCatalogApp} from './support/catalog-app'
import {startFakeRcon} from './support/fake-rcon'

jest.setTimeout(180_000)

describe('catalog RCON API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  let fake: Awaited<ReturnType<typeof startFakeRcon>>
  let serverId = ''

  beforeAll(async () => {
    process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
    fake = await startFakeRcon('secret')
    ctx = await startCatalogApp()
    serverId = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})).id
  })
  afterAll(async () => {
    await ctx.stop()
    await fake.stop()
  })

  const url = () => `/api/admin/catalog/servers/${serverId}/rcon`

  it('needs server.rcon, even with catalog.write', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    await editor.put(url()).send({host: '127.0.0.1', port: fake.port}).expect(403)
    await editor.post(`${url()}/test`).expect(403)
  })

  it('stores the password encrypted, reports it as set and keeps it out of the audit log', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
      .expect(200)
    expect(res.body).toMatchObject({
      rcon: {host: '127.0.0.1', port: fake.port},
      rconPasswordSet: true
    })
    expect(JSON.stringify(res.body)).not.toContain('secret')
    const row = await ctx.prisma.server.findUniqueOrThrow({where: {id: serverId}})
    expect(row.rconPasswordEnc).toMatch(/^v1:/)
    const audit = await ctx.prisma.auditLog.findMany({where: {entityId: serverId}})
    expect(JSON.stringify(audit)).not.toContain('secret')
    expect(JSON.stringify(audit)).not.toContain(row.rconPasswordEnc ?? 'never')
  })

  it('tests the connection against the stored target', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator.post(`${url()}/test`).expect(200)
    expect(res.body).toEqual({ok: true, ms: expect.any(Number) as number})
  })

  it('refuses an internal host when private hosts are not allowed', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    process.env.RCON_ALLOW_PRIVATE_HOSTS = 'false'
    try {
      for (const host of ['127.0.0.1', '10.0.0.5', 'localhost'])
        await operator
          .put(url())
          .send({host, port: 25575})
          .expect(400)
          .expect(res => {
            expect(res.body).toMatchObject({message: 'rcon_host_private'})
          })
      await operator
        .post(`${url()}/test`)
        .expect(400)
        .expect(res => {
          expect(res.body).toMatchObject({message: 'rcon_host_private'})
        })
    } finally {
      process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
    }
  })

  it('clears the password', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, clearPassword: true})
      .expect(200)
    expect(res.body).toMatchObject({rconPasswordSet: false})
    await operator
      .post(`${url()}/test`)
      .expect(400)
      .expect(r => {
        expect(r.body).toMatchObject({message: 'rcon_not_configured'})
      })
  })

  it('answers 503 rcon_key_missing without a key', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const saved = process.env.RCON_ENCRYPTION_KEY
    delete process.env.RCON_ENCRYPTION_KEY
    try {
      await operator
        .put(url())
        .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
        .expect(503)
        .expect(res => {
          expect(res.body).toMatchObject({message: 'rcon_key_missing'})
        })
    } finally {
      process.env.RCON_ENCRYPTION_KEY = saved
    }
  })

  it('allows 5 tests per minute per session', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
      .expect(200)
    for (let i = 0; i < 5; i++) await operator.post(`${url()}/test`).expect(200)
    await operator.post(`${url()}/test`).expect(429)
  })
})
```

`relaxRateLimits()` does not touch `RATE_LIMIT_RCON_TEST`, so the last test sees the real limit; every other test uses a fresh session.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/throttle && pnpm --filter @shop/api test:int -- test/catalog-rcon.int-spec.ts`
Expected: FAIL: `rconTest` undefined; 404 on the RCON routes.

- [ ] **Step 3: Implement**

`rate-limits.ts`: add to `RateLimits`

```ts
/** RCON connection tests per session per minute (each one opens a socket to a game server). */
rconTest: number
```

to `RATE_LIMIT_DEFAULTS` `rconTest: 5`, and to `ENV_NAMES` `rconTest: 'RATE_LIMIT_RCON_TEST'`.

`throttle.module.ts`: next to `ADMIN_PATH`

```ts
const RCON_TEST_PATH = /^\/api\/admin\/catalog\/servers\/[^/]+\/rcon\/test(?:[?#]|$)/i
```

and a fourth throttler in the `throttlers` array:

```ts
{
  name: 'rconTest',
  ttl: 60_000,
  limit: limits.rconTest,
  skipIf: ctx => !RCON_TEST_PATH.test(adminRequest(ctx).originalUrl ?? adminRequest(ctx).url ?? ''),
  getTracker: req => adminTracker(req as ThrottledRequest)
}
```

`server-rcon.service.ts`:

```ts
import {Inject, Injectable} from '@nestjs/common'

import type {AdminServer, RconInput, RconTestResult} from '@shop/shared/catalog-admin'

import {badRequest, notFound, serviceUnavailable} from '../../common/http-errors'
import type {Prisma} from '../../generated/prisma/client'
import {PrismaService} from '../../prisma/prisma.service'
import {serverInclude, toAdminServer} from '../servers.mapper'
import {RconKeyMissingError, decryptRconPassword, encryptRconPassword, rconKey} from './rcon-crypto'
import {RconHostPrivateError, resolveRconHost} from './rcon-host'
import {RCON_TESTER, type RconTester} from './rcon-tester'

const TEST_TIMEOUT_MS = 5000

@Injectable()
export class ServerRconService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RCON_TESTER) private readonly tester: RconTester
  ) {}

  private key(): Buffer {
    try {
      return rconKey()
    } catch (error) {
      if (error instanceof RconKeyMissingError) throw serviceUnavailable('rcon_key_missing')
      throw error
    }
  }

  /** Private → 400; a name that does not resolve → 400 on save, `unreachable` on test. */
  private async address(host: string): Promise<string | null> {
    try {
      return await resolveRconHost(host)
    } catch (error) {
      if (error instanceof RconHostPrivateError) throw badRequest('rcon_host_private')
      return null
    }
  }

  async update(
    id: string,
    input: RconInput,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    if (input.host !== null && (await this.address(input.host)) === null)
      throw badRequest('rcon_host_unresolvable')
    before(toAdminServer(current, true))
    const data: Prisma.ServerUpdateInput = {rconHost: input.host, rconPort: input.port}
    if (input.password !== undefined)
      data.rconPasswordEnc = encryptRconPassword(input.password, this.key())
    if (input.clearPassword === true) data.rconPasswordEnc = null
    // Not versioned: RCON fields are not part of the server form, and last write wins here.
    const row = await this.prisma.server.update({where: {id}, data, include: serverInclude})
    return toAdminServer(row, true)
  }

  async test(id: string): Promise<RconTestResult> {
    const server = await this.prisma.server.findUnique({where: {id}})
    if (!server) throw notFound()
    const {rconHost: host, rconPort: port, rconPasswordEnc: stored} = server
    if (!host || !port || !stored) throw badRequest('rcon_not_configured')
    const key = this.key()
    let password: string
    try {
      password = decryptRconPassword(stored, key)
    } catch {
      return {ok: false, error: 'decrypt_failed'}
    }
    const address = await this.address(host)
    if (address === null) return {ok: false, error: 'unreachable'}
    return this.tester.test({host: address, port, password}, TEST_TIMEOUT_MS)
  }
}
```

`server-rcon.controller.ts`:

```ts
import {Body, HttpCode, Param, Post, Put, Req} from '@nestjs/common'

import {
  type AdminServer,
  type RconInput,
  RconInputSchema,
  type RconTestResult
} from '@shop/shared/catalog-admin'

import {AdminController} from '../../access/admin-controller'
import {RequirePermission} from '../../access/require-permission'
import {type AuditableRequest, Audited} from '../../audit/audit.interceptor'
import {ValibotPipe} from '../../common/valibot.pipe'
import {ServerRconService} from './server-rcon.service'

@AdminController('catalog/servers')
export class ServerRconController {
  constructor(private readonly rcon: ServerRconService) {}

  @Put(':id/rcon')
  @RequirePermission('server.rcon')
  @Audited('server.rcon', 'server')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(RconInputSchema)) body: RconInput,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.rcon.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Post(':id/rcon/test')
  @HttpCode(200)
  @RequirePermission('server.rcon')
  @Audited('server.rcon_test', 'server')
  test(@Param('id') id: string): Promise<RconTestResult> {
    return this.rcon.test(id)
  }
}
```

In `CatalogAdminModule` add `ServerRconController`, `ServerRconService` and `{provide: RCON_TESTER, useClass: RconClientTester}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int -- test/catalog-rcon.int-spec.ts test/rate-limit.int-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): rcon settings and connection test for catalog servers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Products API: CRUD and integrity rules

**Files:**

- Create: `apps/api/src/catalog-admin/products.mapper.ts`, `products.mapper.spec.ts`, `products.service.ts`, `products.controller.ts`
- Modify: `apps/api/src/catalog-admin/catalog-admin.module.ts`
- Create: `apps/api/test/catalog-products.int-spec.ts`

**Interfaces:**

- Consumes: Task 1 product schemas and `missingForActive`; Task 3 helpers.
- Produces: `productInclude`, `toAdminProduct(row): AdminProduct`, `toListItem(row): AdminProductListItem`; routes `GET /products?serverId=&categoryId=`, `POST /products`, `GET|PATCH|DELETE /products/:id`; `ProductsService.order(serverId, categoryId, ids)` is added in Task 9.

- [ ] **Step 1: Write the failing tests**

`products.mapper.spec.ts`:

```ts
import {toAdminProduct} from './products.mapper'

const row = {
  id: 'p1',
  version: 2,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'PERMANENT' as const,
  durationDays: null,
  mark: 'VIP',
  icon: 'crown' as const,
  isActive: false,
  grantCommands: ['lp user {nick} parent add vip'],
  revokeCommands: [],
  translations: [
    {productId: 'p1', locale: 'en' as const, name: 'VIP', description: 'd', sections: []}
  ],
  prices: [{productId: 'p1', currency: 'EUR' as const, amountMinor: 499}]
}

describe('toAdminProduct', () => {
  it('fills missing locales and currencies with null and lists them as missing', () => {
    const p = toAdminProduct(row)
    expect(p.prices).toEqual({EUR: 499, PLN: null})
    expect(p.translations).toEqual({en: {name: 'VIP', description: 'd', sections: []}, pl: null})
    expect(p.missing).toEqual(['price.PLN', 'translation.pl'])
  })
})
```

(Add any other columns the Prisma `Product` type requires, e.g. `rconTemplate`-like fields, by copying them from `schema.prisma`; the mapper only reads the ones above.)

`apps/api/test/catalog-products.int-spec.ts`:

```ts
import request from 'supertest'

import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

type ProductBody = {id: string; version: number; isActive: boolean; missing: string[]; sort: number}

describe('catalog products API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  let survival = ''
  let anarchy = ''
  let ranks = ''
  let editor: Awaited<ReturnType<typeof ctx.admin>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
    survival = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})).id
    anarchy = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'anarchy'}})).id
    ranks = (await ctx.prisma.category.findUniqueOrThrow({where: {slug: 'ranks'}})).id
    editor = await ctx.admin({permissions: ['catalog.write']})
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const en = {
    name: 'Probe',
    description: 'A test rank',
    sections: [{title: 'Perks', entries: [{cmd: '/fly'}]}]
  }
  const draft = () => ({
    serverId: survival,
    categoryId: ranks,
    slug: `probe-${String(Date.now())}`,
    kind: 'TIMED',
    durationDays: 30,
    mark: 'PRB',
    icon: 'crown',
    grantCommands: ['lp user {nick} parent addtemp probe 30d'],
    revokeCommands: ['lp user {nick} parent remove probe'],
    prices: {EUR: 499, PLN: null},
    translations: {en, pl: null}
  })
  const storefront = async () =>
    (
      (await request(ctx.app.getHttpServer()).get('/api/catalog?locale=en').expect(200)).body as {
        products: {slug: string; server: string}[]
      }
    ).products

  it('creates a disabled draft at the end of its list, hidden from the storefront', async () => {
    const body = draft()
    const res = await editor.post('/api/admin/catalog/products').send(body).expect(201)
    const p = res.body as ProductBody
    expect(p).toMatchObject({isActive: false, version: 1, missing: ['price.PLN', 'translation.pl']})
    const others = await ctx.prisma.product.count({where: {serverId: survival, categoryId: ranks}})
    expect(p.sort).toBe(others - 1)
    expect((await storefront()).some(s => s.slug === body.slug)).toBe(false)
  })

  it('will not enable an incomplete product and lists what is missing', async () => {
    const created = (await editor.post('/api/admin/catalog/products').send(draft()).expect(201))
      .body as ProductBody
    const res = await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...draft(), isActive: true, version: 1})
      .expect(400)
    expect(res.body).toMatchObject({
      message: 'incomplete',
      issues: {missing: ['price.PLN', 'translation.pl']}
    })
  })

  it('enables a complete product and the storefront shows it', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {
      ...body,
      prices: {EUR: 499, PLN: 2199},
      translations: {en, pl: {...en, name: 'Sonda'}}
    }
    const res = await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    expect(res.body).toMatchObject({isActive: true, version: 2, missing: []})
    expect((await storefront()).some(s => s.slug === body.slug)).toBe(true)
  })

  it('keeps an enabled product complete: clearing a translation is 400 and changes nothing', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {...body, prices: {EUR: 499, PLN: 2199}, translations: {en, pl: en}}
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, translations: {en, pl: null}, isActive: true, version: 2})
      .expect(400)
    const stored = await ctx.prisma.productTranslation.count({where: {productId: created.id}})
    expect(stored).toBe(2)
  })

  it('locks slug and server of an enabled product', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {...body, prices: {EUR: 499, PLN: 2199}, translations: {en, pl: en}}
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, slug: `${body.slug}-x`, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, serverId: anarchy, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
  })

  it('refuses a category that is not attached to the server', async () => {
    const lonely = await ctx.prisma.category.create({
      data: {
        slug: 'lonely',
        translations: {
          create: [
            {locale: 'en', name: 'L'},
            {locale: 'pl', name: 'L'}
          ]
        }
      }
    })
    await editor
      .post('/api/admin/catalog/products')
      .send({...draft(), categoryId: lonely.id})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'category_not_on_server'})
      })
  })

  it('refuses another placeholder in a command', async () => {
    await editor
      .post('/api/admin/catalog/products')
      .send({...draft(), grantCommands: ['give {player} diamond']})
      .expect(400)
  })

  it('answers 409 stale for an old version and deletes with the current one', async () => {
    const created = (await editor.post('/api/admin/catalog/products').send(draft()).expect(201))
      .body as ProductBody
    await editor.delete(`/api/admin/catalog/products/${created.id}?version=7`).expect(409)
    await editor.delete(`/api/admin/catalog/products/${created.id}?version=1`).expect(204)
    await editor.get(`/api/admin/catalog/products/${created.id}`).expect(404)
  })

  it('lists products of one server and category in order for any admin', async () => {
    const support = await ctx.admin('SUPPORT')
    const res = await support
      .get(`/api/admin/catalog/products?serverId=${survival}&categoryId=${ranks}`)
      .expect(200)
    const list = res.body as {sort: number; name: string; serverId: string}[]
    expect(list.length).toBeGreaterThan(0)
    expect(list.every(p => p.serverId === survival)).toBe(true)
    expect(list.map(p => p.sort)).toEqual([...list.map(p => p.sort)].sort((a, b) => a - b))
    await support.post('/api/admin/catalog/products').send(draft()).expect(403)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/catalog-admin/products.mapper.spec.ts && pnpm --filter @shop/api test:int -- test/catalog-products.int-spec.ts`
Expected: FAIL: mapper module missing; 404 on `/products`.

- [ ] **Step 3: Implement**

`products.mapper.ts`:

```ts
import * as v from 'valibot'

import {LOCALES, ProductSectionSchema} from '@shop/shared/catalog'
import {
  type AdminProduct,
  type AdminProductListItem,
  missingForActive
} from '@shop/shared/catalog-admin'

import type {Prisma} from '../generated/prisma/client'

export const productInclude = {translations: true, prices: true} satisfies Prisma.ProductInclude
export type ProductRow = Prisma.ProductGetPayload<{include: typeof productInclude}>

const Sections = v.array(ProductSectionSchema)

const pricesOf = (r: Pick<ProductRow, 'prices'>): AdminProduct['prices'] => ({
  EUR: r.prices.find(p => p.currency === 'EUR')?.amountMinor ?? null,
  PLN: r.prices.find(p => p.currency === 'PLN')?.amountMinor ?? null
})

const translationsOf = (r: Pick<ProductRow, 'translations'>): AdminProduct['translations'] => {
  const one = (locale: (typeof LOCALES)[number]) => {
    const t = r.translations.find(x => x.locale === locale)
    // Same rule as the public catalog: stored sections must match the shared schema.
    return t
      ? {name: t.name, description: t.description, sections: v.parse(Sections, t.sections)}
      : null
  }
  return {en: one('en'), pl: one('pl')}
}

export function toAdminProduct(r: ProductRow): AdminProduct {
  const prices = pricesOf(r)
  const translations = translationsOf(r)
  return {
    id: r.id,
    version: r.version,
    sort: r.sort,
    serverId: r.serverId,
    categoryId: r.categoryId,
    slug: r.slug,
    kind: r.kind,
    durationDays: r.durationDays,
    mark: r.mark,
    icon: r.icon,
    isActive: r.isActive,
    grantCommands: r.grantCommands,
    revokeCommands: r.revokeCommands,
    prices,
    translations,
    missing: missingForActive({prices, translations})
  }
}

export function toListItem(r: ProductRow): AdminProductListItem {
  const p = toAdminProduct(r)
  return {
    id: p.id,
    version: p.version,
    sort: p.sort,
    serverId: p.serverId,
    categoryId: p.categoryId,
    slug: p.slug,
    kind: p.kind,
    mark: p.mark,
    icon: p.icon,
    name: p.translations.en?.name ?? p.slug,
    isActive: p.isActive,
    prices: p.prices,
    missing: p.missing
  }
}
```

`products.service.ts`:

```ts
import {Injectable} from '@nestjs/common'

import {CURRENCIES, LOCALES} from '@shop/shared/catalog'
import {
  type AdminProduct,
  type AdminProductListItem,
  type ProductCreate,
  type ProductListQuery,
  type ProductUpdate,
  missingForActive
} from '@shop/shared/catalog-admin'

import {badRequest, conflict, notFound, stale} from '../common/http-errors'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {isPrismaError} from './order'
import {productInclude, toAdminProduct, toListItem} from './products.mapper'
import {assertUpdated} from './versioned'

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

type Tx = Prisma.TransactionClient

/** The product's category must be attached to its server (spec §3 rule 3). */
async function assertPlacement(tx: Tx, serverId: string, categoryId: string): Promise<void> {
  const link = await tx.serverCategory.findUnique({
    where: {serverId_categoryId: {serverId, categoryId}}
  })
  if (!link) throw badRequest('category_not_on_server')
}

async function nextSort(tx: Tx, serverId: string, categoryId: string): Promise<number> {
  const {_max} = await tx.product.aggregate({where: {serverId, categoryId}, _max: {sort: true}})
  return (_max.sort ?? -1) + 1
}

const translationRows = (input: ProductCreate) =>
  LOCALES.flatMap(locale => {
    const t = input.translations[locale]
    return t ? [{locale, ...t, sections: t.sections as Prisma.InputJsonValue}] : []
  })
/** The product's own columns (translations and prices live in their tables). */
const columns = (input: ProductCreate) => ({
  serverId: input.serverId,
  categoryId: input.categoryId,
  slug: input.slug,
  kind: input.kind,
  durationDays: input.durationDays,
  mark: input.mark,
  icon: input.icon,
  grantCommands: input.grantCommands,
  revokeCommands: input.revokeCommands
})
const priceRows = (input: ProductCreate) =>
  CURRENCIES.flatMap(currency => {
    const amountMinor = input.prices[currency]
    return amountMinor === null ? [] : [{currency, amountMinor}]
  })

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductListQuery): Promise<AdminProductListItem[]> {
    const rows = await this.prisma.product.findMany({
      where: {serverId: query.serverId, categoryId: query.categoryId},
      include: productInclude,
      orderBy: [{sort: 'asc'}, {slug: 'asc'}]
    })
    return rows.map(toListItem)
  }

  async get(id: string): Promise<AdminProduct> {
    const row = await this.prisma.product.findUnique({where: {id}, include: productInclude})
    if (!row) throw notFound()
    return toAdminProduct(row)
  }

  /** Created disabled and last in its category (spec decision #5). */
  async create(input: ProductCreate): Promise<AdminProduct> {
    const row = await this.prisma
      .$transaction(async tx => {
        await assertPlacement(tx, input.serverId, input.categoryId)
        return tx.product.create({
          data: {
            ...columns(input),
            isActive: false,
            sort: await nextSort(tx, input.serverId, input.categoryId),
            translations: {create: translationRows(input)},
            prices: {create: priceRows(input)}
          },
          include: productInclude
        })
      })
      .catch(slugTaken)
    return toAdminProduct(row)
  }

  async update(
    id: string,
    input: ProductUpdate,
    before: (p: AdminProduct) => void
  ): Promise<AdminProduct> {
    const row = await this.prisma
      .$transaction(async tx => {
        const current = await tx.product.findUnique({where: {id}, include: productInclude})
        if (!current) throw notFound()
        // Slug and server are in storefront URLs and cart cookies (spec decision #9).
        if (
          current.isActive &&
          (input.slug !== current.slug || input.serverId !== current.serverId)
        )
          throw badRequest('slug_locked')
        await assertPlacement(tx, input.serverId, input.categoryId)
        const missing = missingForActive(input)
        if (input.isActive && missing.length > 0) throw badRequest('incomplete', {missing})
        before(toAdminProduct(current))

        const moved = input.serverId !== current.serverId || input.categoryId !== current.categoryId
        const {count} = await tx.product.updateMany({
          where: {id, version: input.version},
          data: {
            ...columns(input),
            isActive: input.isActive,
            ...(moved && {sort: await nextSort(tx, input.serverId, input.categoryId)}),
            version: {increment: 1}
          }
        })
        await assertUpdated(count, async () => (await tx.product.count({where: {id}})) > 0)

        const keepLocales = translationRows(input).map(t => t.locale)
        await tx.productTranslation.deleteMany({
          where: {productId: id, locale: {notIn: keepLocales}}
        })
        for (const t of translationRows(input))
          await tx.productTranslation.upsert({
            where: {productId_locale: {productId: id, locale: t.locale}},
            create: {productId: id, ...t},
            update: t
          })
        const keepCurrencies = priceRows(input).map(p => p.currency)
        await tx.price.deleteMany({where: {productId: id, currency: {notIn: keepCurrencies}}})
        for (const p of priceRows(input))
          await tx.price.upsert({
            where: {productId_currency: {productId: id, currency: p.currency}},
            create: {productId: id, ...p},
            update: {amountMinor: p.amountMinor}
          })
        return tx.product.findUniqueOrThrow({where: {id}, include: productInclude})
      })
      .catch(slugTaken)
    return toAdminProduct(row)
  }

  /** Nothing references products yet; orders (sub-project 4) add their count here as `in_use`. */
  async remove(id: string, version: number, before: (p: AdminProduct) => void): Promise<void> {
    const current = await this.prisma.product.findUnique({where: {id}, include: productInclude})
    if (!current) throw notFound()
    before(toAdminProduct(current))
    const {count} = await this.prisma.product.deleteMany({where: {id, version}})
    if (count === 0) throw stale()
  }
}
```

Check the composite key names (`productId_locale`, `productId_currency`, `serverId_categoryId`) against the generated client.

`products.controller.ts`:

```ts
import {Body, Delete, Get, HttpCode, Param, Patch, Post, Query, Req} from '@nestjs/common'

import {
  type AdminProduct,
  type AdminProductListItem,
  type ProductCreate,
  ProductCreateSchema,
  type ProductListQuery,
  ProductListQuerySchema,
  type ProductUpdate,
  ProductUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {ProductsService} from './products.service'

@AdminController('catalog')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products')
  list(
    @Query(new ValibotPipe(ProductListQuerySchema)) query: ProductListQuery
  ): Promise<AdminProductListItem[]> {
    return this.products.list(query)
  }

  @Get('products/:id')
  get(@Param('id') id: string): Promise<AdminProduct> {
    return this.products.get(id)
  }

  @Post('products')
  @RequirePermission('catalog.write')
  @Audited('product.create', 'product')
  create(@Body(new ValibotPipe(ProductCreateSchema)) body: ProductCreate): Promise<AdminProduct> {
    return this.products.create(body)
  }

  @Patch('products/:id')
  @RequirePermission('catalog.write')
  @Audited('product.update', 'product')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(ProductUpdateSchema)) body: ProductUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminProduct> {
    return this.products.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Delete('products/:id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('product.delete', 'product')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.products.remove(id, query.version, before => {
      req.auditBefore = before
    })
  }
}
```

Register in `CatalogAdminModule`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int -- test/catalog-products.int-spec.ts test/catalog.int-spec.ts`
Expected: PASS; the public catalog suite is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): catalog products admin API with completeness and slug rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Product order

**Files:**

- Modify: `apps/api/src/catalog-admin/products.service.ts`, `apps/api/src/catalog-admin/products.controller.ts`
- Modify: `apps/api/test/catalog-products.int-spec.ts`

**Interfaces:**

- Produces: `PUT /api/admin/catalog/servers/:serverId/categories/:categoryId/products/order` → `AdminProductListItem[]` (that list, new order).

- [ ] **Step 1: Write the failing test**

Append to `catalog-products.int-spec.ts`:

```ts
it('reorders a category and the storefront follows; an out-of-date list changes nothing', async () => {
  const listUrl = `/api/admin/catalog/products?serverId=${survival}&categoryId=${ranks}`
  const orderUrl = `/api/admin/catalog/servers/${survival}/categories/${ranks}/products/order`
  const ids = ((await editor.get(listUrl).expect(200)).body as {id: string}[]).map(p => p.id)
  const reversed = [...ids].reverse()

  const res = await editor.put(orderUrl).send({ids: reversed}).expect(200)
  expect((res.body as {id: string}[]).map(p => p.id)).toEqual(reversed)

  const activeSlugs = (
    await ctx.prisma.product.findMany({
      where: {serverId: survival, categoryId: ranks, isActive: true},
      orderBy: {sort: 'asc'},
      select: {slug: true}
    })
  ).map(p => p.slug)
  const shown = (await storefront()).filter(p => activeSlugs.includes(p.slug)).map(p => p.slug)
  expect(shown).toEqual(activeSlugs)

  await editor
    .put(orderUrl)
    .send({ids: reversed.slice(1)})
    .expect(409)
  await editor
    .put(orderUrl)
    .send({ids: [...reversed.slice(1), 'stranger']})
    .expect(409)
  const after = ((await editor.get(listUrl).expect(200)).body as {id: string}[]).map(p => p.id)
  expect(after).toEqual(reversed)
})

it('reordering does not change versions, so open edit forms stay valid', async () => {
  const before = await ctx.prisma.product.findMany({where: {serverId: survival, categoryId: ranks}})
  const orderUrl = `/api/admin/catalog/servers/${survival}/categories/${ranks}/products/order`
  await editor
    .put(orderUrl)
    .send({ids: before.map(p => p.id).reverse()})
    .expect(200)
  const after = await ctx.prisma.product.findMany({where: {serverId: survival, categoryId: ranks}})
  expect(after.map(p => [p.id, p.version]).sort()).toEqual(
    before.map(p => [p.id, p.version]).sort()
  )
})
```

The storefront check compares against the database order of enabled products because the public mapper orders by `sort` too.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @shop/api test:int -- test/catalog-products.int-spec.ts`
Expected: FAIL: 404 on the order route.

- [ ] **Step 3: Implement**

`products.service.ts`, add (import `assertSameSet`, `serializable` from `./order`):

```ts
  async order(serverId: string, categoryId: string, ids: string[]): Promise<AdminProductListItem[]> {
    await serializable(this.prisma, async tx => {
      const current = await tx.product.findMany({where: {serverId, categoryId}, select: {id: true}})
      assertSameSet(
        current.map(p => p.id),
        ids
      )
      for (const [sort, id] of ids.entries()) await tx.product.update({where: {id}, data: {sort}})
    })
    return this.list({serverId, categoryId})
  }
```

`products.controller.ts`, add (import `Put`, `OrderInputSchema`):

```ts
  @Put('servers/:serverId/categories/:categoryId/products/order')
  @RequirePermission('catalog.write')
  @Audited('product.order', 'product')
  order(
    @Param('serverId') serverId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ValibotPipe(OrderInputSchema)) body: {ids: string[]}
  ): Promise<AdminProductListItem[]> {
    return this.products.order(serverId, categoryId, body.ids)
  }
```

Note: an empty category cannot be reordered (`ids` has `minLength(1)`); the admin never sends an empty list.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test:int -- test/catalog-products.int-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): reorder products within a server category

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Swagger for every catalog route, and the admin client

**Files:**

- Create: `apps/api/src/openapi/helpers.ts`, `apps/api/src/openapi/catalog-admin-paths.ts`
- Modify: `apps/api/src/openapi/openapi.ts`, `apps/api/src/openapi/openapi.spec.ts`
- Modify: `apps/api/src/access/admin-routes.spec.ts`
- Modify: `apps/api/openapi.json` (regenerated)
- Modify: `apps/admin/src/lib/api/generated.ts` (regenerated), `apps/admin/src/lib/api/tags.ts`

**Interfaces:**

- Produces: generated RTK Query hooks named after these `operationId`s: `listCatalogServers`, `getCatalogServer`, `createCatalogServer`, `updateCatalogServer`, `deleteCatalogServer`, `orderCatalogServers`, `setCatalogServerCategories`, `updateCatalogServerRcon`, `testCatalogServerRcon`, `listCatalogCategories`, `createCatalogCategory`, `updateCatalogCategory`, `deleteCatalogCategory`, `listCatalogProducts`, `getCatalogProduct`, `createCatalogProduct`, `updateCatalogProduct`, `deleteCatalogProduct`, `orderCatalogProducts` (hooks: `useListCatalogServersQuery`, `useUpdateCatalogProductMutation`, …). Path params keep their route names (`id`, `serverId`, `categoryId`), bodies are `body`, `DELETE` takes `version` as a query arg. Cache tags `CatalogServers`, `CatalogCategories`, `CatalogProducts`.

- [ ] **Step 1: Write the failing tests**

`admin-routes.spec.ts`: import `METHOD_METADATA` from `@nestjs/common/constants` and `RequestMethod` from `@nestjs/common`; in `adminRoutes()` also return `method` and `path` for each route:

```ts
.map(path => ({
  route: `${type.name}.${name} /${path}`,
  path,
  method: RequestMethod[
    (Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined) ?? RequestMethod.GET
  ].toLowerCase(),
  guards: meta(GUARDS_METADATA, type, handler),
  interceptors: meta(INTERCEPTORS_METADATA, type, handler)
}))
```

and add:

```ts
import {buildOpenApiDocument} from '../openapi/openapi'

const docPath = (path: string) => `/api/${path.replace(/:(\w+)/g, '{$1}')}`

it('documents every admin route in the OpenAPI document', async () => {
  const doc = buildOpenApiDocument()
  const undocumented = (await adminRoutes())
    .filter(r => !(doc.paths[docPath(r.path)] as Record<string, unknown> | undefined)?.[r.method])
    .map(r => r.route)
  expect(undocumented).toEqual([])
})
```

`openapi.spec.ts`, add:

```ts
it('explains every catalog admin operation and response', () => {
  const ops = Object.entries(doc.paths)
    .filter(([p]) => p.startsWith('/api/admin/catalog'))
    .flatMap(([p, methods]) => Object.entries(methods).map(([m, op]) => ({where: `${m} ${p}`, op})))
  expect(ops.length).toBe(19)
  // Each failure names the operation, so a gap is easy to find.
  const gaps = ops.flatMap(({where, op}) => [
    ...(/^[a-z]\w+$/.test(op.operationId ?? '') ? [] : [`${where}: operationId`]),
    ...(op.tags?.join() === 'Catalog admin' ? [] : [`${where}: tags`]),
    ...(op.summary.trim() ? [] : [`${where}: summary`]),
    ...(op.description?.trim() ? [] : [`${where}: description`]),
    ...Object.entries(op.responses)
      .filter(([, res]) => !res.description.trim())
      .map(([code]) => `${where}: response ${code}`)
  ])
  expect(gaps).toEqual([])
})

it('documents the catalog permission errors and conflicts', () => {
  const patch = doc.paths['/api/admin/catalog/products/{id}']?.patch
  expect(Object.keys(patch?.responses ?? {}).sort()).toEqual(
    ['200', '400', '401', '403', '404', '409'].sort()
  )
  expect(patch?.description).toContain('catalog.write')
  const test = doc.paths['/api/admin/catalog/servers/{id}/rcon/test']?.post
  expect(Object.keys(test?.responses ?? {})).toEqual(
    expect.arrayContaining(['200', '400', '429', '503'])
  )
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/openapi src/access/admin-routes.spec.ts`
Expected: FAIL: 19 catalog routes undocumented; no catalog operations.

- [ ] **Step 3: Implement**

Move `JsonSchema`, `Parameter`, `Response`, `Operation`, `Method`, `OpenApiDocument`, `schema`, `json`, `body`, `pathParam`, `guarded`, `guardedGrant`, `invalid`, `protectedOwner`, `missing` from `openapi.ts` into `helpers.ts` (exported), unchanged except:

```ts
export type Operation = {
  operationId?: string
  tags?: string[]
  summary: string
  description?: string
  parameters?: Parameter[]
  requestBody?: {required: true; content: {'application/json': {schema: JsonSchema}}}
  responses: Record<string, Response>
}
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export const queryParam = (name: string, s: v.GenericSchema, required = false): Parameter => ({
  name,
  in: 'query',
  required,
  schema: schema(s)
})
```

`openapi.ts` imports them from `./helpers` and spreads `...catalogAdminPaths` at the end of `paths`.

`catalog-admin-paths.ts`:

```ts
import * as v from 'valibot'

import {
  AdminCategorySchema,
  AdminProductListItemSchema,
  AdminProductSchema,
  AdminServerSchema,
  CategoryInputSchema,
  CategoryUpdateSchema,
  OrderInputSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  RconInputSchema,
  RconTestResultSchema,
  ServerCategoriesInputSchema,
  ServerCreateSchema,
  ServerUpdateSchema
} from '@shop/shared/catalog-admin'

import {
  type Method,
  type Operation,
  body,
  guarded,
  json,
  missing,
  pathParam,
  queryParam
} from './helpers'

const tags = ['Catalog admin']
const LIVE = 'The storefront caches the catalog for 60 s, so the change is live within a minute.'

const read = 'Any signed-in admin (session with TOTP) may call it.'
const write = 'Needs `catalog.write`.'
const rcon = 'Needs `server.rcon`.'

const invalid = (what: string) => ({'400': {description: `Invalid body: ${what}`}})
const stale = {
  '409': {
    description: '`stale`: the record changed since you read it (send the current `version`)'
  }
}
const slugTaken = {'409': {description: '`slug_taken`, or `stale` (out-of-date `version`)'}}
const inUse = (what: string) => ({
  '409': {
    description: `\`in_use\`: ${what}; \`issues\` carries the counts. Or \`stale\` (out-of-date \`version\`).`
  }
})
const versionQuery = queryParam(
  'version',
  v.pipe(v.string(), v.description('The version you read')),
  true
)
const noContent = {'204': {description: 'Deleted'}}
const orderStale = {
  '409': {
    description:
      '`stale`: the ids are not exactly the current list (someone added, removed or reordered)'
  }
}

const op = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags})

export const catalogAdminPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/admin/catalog/servers': {
    get: op({
      operationId: 'listCatalogServers',
      summary: 'Servers in storefront tab order',
      description: `Every server, enabled or not, with its attached categories in display order and its product count. RCON host and port are filled only for viewers with \`server.rcon\`. ${read}`,
      responses: {'200': json('Servers', v.array(AdminServerSchema)), ...guarded}
    }),
    post: op({
      operationId: 'createCatalogServer',
      summary: 'Create a server (disabled, last tab)',
      description: `Creates a disabled server at the end of the tab order; enable it with PATCH once it has categories and products. ${write}`,
      requestBody: body(ServerCreateSchema),
      responses: {
        '201': json('The new server', AdminServerSchema),
        ...invalid('slug, name or colors'),
        ...guarded,
        '409': {description: '`slug_taken`'}
      }
    })
  },
  '/api/admin/catalog/servers/order': {
    put: op({
      operationId: 'orderCatalogServers',
      summary: 'Reorder the server tabs',
      description: `Send every server id in the new tab order. Versions do not change. ${write} ${LIVE}`,
      requestBody: body(OrderInputSchema),
      responses: {
        '200': json('Servers in the new order', v.array(AdminServerSchema)),
        ...invalid('duplicate or empty ids'),
        ...guarded,
        ...orderStale
      }
    })
  },
  '/api/admin/catalog/servers/{id}': {
    get: op({
      operationId: 'getCatalogServer',
      summary: 'One server',
      description: `RCON host and port only with \`server.rcon\`; the password is never returned, only \`rconPasswordSet\`. ${read}`,
      parameters: [pathParam('id')],
      responses: {'200': json('The server', AdminServerSchema), ...guarded, ...missing}
    }),
    patch: op({
      operationId: 'updateCatalogServer',
      summary: 'Edit name, slug, colors or enabled state',
      description: `The slug can change only while the server is disabled (it is in storefront URLs and cart cookies). ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ServerUpdateSchema),
      responses: {
        '200': json('The updated server', AdminServerSchema),
        '400': {description: 'Invalid body, or `slug_locked` (slug change on an enabled server)'},
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogServer',
      summary: 'Delete a server without products',
      description: `Allowed only while the server has no products; otherwise disable it. Its category links go with it. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {...noContent, ...guarded, ...missing, ...inUse('the server still has products')}
    })
  },
  '/api/admin/catalog/servers/{id}/categories': {
    put: op({
      operationId: 'setCatalogServerCategories',
      summary: 'Attach, detach and order a server’s categories',
      description: `Send the full list of attached category ids in display order. Ids not in the list are detached, which is refused while the server has products in them. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ServerCategoriesInputSchema),
      responses: {
        '200': json('The server with its categories', AdminServerSchema),
        '400': {description: 'Invalid body, or `unknown_category`'},
        ...guarded,
        ...missing,
        '409': {
          description:
            '`in_use`: a detached category still has products on this server (`issues.products`), or `stale` (concurrent change)'
        }
      }
    })
  },
  '/api/admin/catalog/servers/{id}/rcon': {
    put: op({
      operationId: 'updateCatalogServerRcon',
      summary: 'Set the RCON address and password',
      description: `Host and port of the game server’s RCON. Send \`password\` to replace it (stored AES-256-GCM encrypted, never returned) or \`clearPassword: true\` to remove it. Internal addresses are refused. ${rcon}`,
      parameters: [pathParam('id')],
      requestBody: body(RconInputSchema),
      responses: {
        '200': json('The server', AdminServerSchema),
        '400': {
          description:
            'Invalid body, `rcon_host_private` (loopback, private or link-local address) or `rcon_host_unresolvable`'
        },
        ...guarded,
        ...missing,
        '503': {description: '`rcon_key_missing`: RCON_ENCRYPTION_KEY is not configured'}
      }
    })
  },
  '/api/admin/catalog/servers/{id}/rcon/test': {
    post: op({
      operationId: 'testCatalogServerRcon',
      summary: 'Test the RCON connection',
      description: `Connects to the stored address, signs in and runs \`list\` with a 5 s timeout. A failed connection is a 200 with \`ok: false\`, not an error. At most 5 per minute per session. ${rcon}`,
      parameters: [pathParam('id')],
      responses: {
        '200': json('`{ok: true, ms}` or `{ok: false, error}`', RconTestResultSchema),
        '400': {
          description:
            '`rcon_not_configured` (host, port or password missing) or `rcon_host_private`'
        },
        ...guarded,
        ...missing,
        '429': {description: 'More than 5 tests in a minute'},
        '503': {description: '`rcon_key_missing`'}
      }
    })
  },
  '/api/admin/catalog/categories': {
    get: op({
      operationId: 'listCatalogCategories',
      summary: 'All categories',
      description: `Each with its English and Polish name, the servers it is attached to and its product count. ${read}`,
      responses: {'200': json('Categories', v.array(AdminCategorySchema)), ...guarded}
    }),
    post: op({
      operationId: 'createCatalogCategory',
      summary: 'Create a category',
      description: `Both names are required. Attach it to servers with PUT /servers/{id}/categories. ${write}`,
      requestBody: body(CategoryInputSchema),
      responses: {
        '201': json('The new category', AdminCategorySchema),
        ...invalid('slug or names'),
        ...guarded,
        '409': {description: '`slug_taken`'}
      }
    })
  },
  '/api/admin/catalog/categories/{id}': {
    patch: op({
      operationId: 'updateCatalogCategory',
      summary: 'Rename a category',
      description: `Changes slug and names. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(CategoryUpdateSchema),
      responses: {
        '200': json('The updated category', AdminCategorySchema),
        ...invalid('slug or names'),
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogCategory',
      summary: 'Delete an unused category',
      description: `Allowed only while no product uses it and no server has it attached. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {
        ...noContent,
        ...guarded,
        ...missing,
        ...inUse('products use it or servers have it attached')
      }
    })
  },
  '/api/admin/catalog/products': {
    get: op({
      operationId: 'listCatalogProducts',
      summary: 'Products in display order',
      description: `Filter by server and category to get one storefront list. Disabled and incomplete products are included, with \`missing\`. ${read}`,
      parameters: [
        queryParam('serverId', v.pipe(v.string(), v.description('Only this server'))),
        queryParam('categoryId', v.pipe(v.string(), v.description('Only this category')))
      ],
      responses: {
        '200': json('Products', v.array(AdminProductListItemSchema)),
        '400': {description: 'Invalid query'},
        ...guarded
      }
    }),
    post: op({
      operationId: 'createCatalogProduct',
      summary: 'Create a product (disabled draft)',
      description: `Created disabled and last in its category; prices and translations may still be missing. The category must be attached to the server. Commands may only use the \`{nick}\` placeholder. ${write}`,
      requestBody: body(ProductCreateSchema),
      responses: {
        '201': json('The new product', AdminProductSchema),
        '400': {
          description:
            'Invalid body (slug, price, `{nick}`-only commands, durationDays vs kind) or `category_not_on_server`'
        },
        ...guarded,
        '409': {description: '`slug_taken` on this server'}
      }
    })
  },
  '/api/admin/catalog/products/{id}': {
    get: op({
      operationId: 'getCatalogProduct',
      summary: 'One product with commands, prices and translations',
      description: `Everything the editor shows, including \`missing\`. ${read}`,
      parameters: [pathParam('id')],
      responses: {'200': json('The product', AdminProductSchema), ...guarded, ...missing}
    }),
    patch: op({
      operationId: 'updateCatalogProduct',
      summary: 'Edit a product',
      description: `Replaces fields, prices and translations (null removes one). An enabled product must keep both prices and both translations; slug and server change only while it is disabled. Moving it to another category puts it last there. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ProductUpdateSchema),
      responses: {
        '200': json('The updated product', AdminProductSchema),
        '400': {
          description:
            'Invalid body, `incomplete` (`issues.missing` lists the gaps), `slug_locked` or `category_not_on_server`'
        },
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogProduct',
      summary: 'Delete a product',
      description: `Removes the product with its prices and translations. Once orders exist, a product with orders can only be disabled. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {...noContent, ...guarded, ...missing, ...stale}
    })
  },
  '/api/admin/catalog/servers/{serverId}/categories/{categoryId}/products/order': {
    put: op({
      operationId: 'orderCatalogProducts',
      summary: 'Reorder the products of one category on one server',
      description: `Send every product id of that list in the new order (this is the order on the storefront). Versions do not change. ${write} ${LIVE}`,
      parameters: [pathParam('serverId'), pathParam('categoryId')],
      requestBody: body(OrderInputSchema),
      responses: {
        '200': json('The list in its new order', v.array(AdminProductListItemSchema)),
        ...invalid('duplicate or empty ids'),
        ...guarded,
        ...orderStale
      }
    })
  }
}
```

Regenerate: `pnpm --filter @shop/api openapi`, then `pnpm --filter @shop/admin codegen`.

`apps/admin/src/lib/api/tags.ts`: add `'CatalogServers', 'CatalogCategories', 'CatalogProducts'` to `addTagTypes`, and:

```ts
    listCatalogServers: {providesTags: ['CatalogServers']},
    getCatalogServer: {providesTags: ['CatalogServers']},
    createCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    updateCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    deleteCatalogServer: {invalidatesTags: ['CatalogServers', 'Audit']},
    orderCatalogServers: {invalidatesTags: ['CatalogServers', 'Audit']},
    setCatalogServerCategories: {invalidatesTags: ['CatalogServers', 'CatalogCategories', 'Audit']},
    updateCatalogServerRcon: {invalidatesTags: ['CatalogServers', 'Audit']},
    testCatalogServerRcon: {invalidatesTags: ['Audit']},
    listCatalogCategories: {providesTags: ['CatalogCategories']},
    createCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    updateCatalogCategory: {invalidatesTags: ['CatalogCategories', 'CatalogServers', 'Audit']},
    deleteCatalogCategory: {invalidatesTags: ['CatalogCategories', 'Audit']},
    listCatalogProducts: {providesTags: ['CatalogProducts']},
    getCatalogProduct: {providesTags: ['CatalogProducts']},
    createCatalogProduct: {invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']},
    updateCatalogProduct: {invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']},
    deleteCatalogProduct: {invalidatesTags: ['CatalogProducts', 'CatalogServers', 'CatalogCategories', 'Audit']},
    orderCatalogProducts: {invalidatesTags: ['CatalogProducts', 'Audit']}
```

If codegen names the endpoints differently (it should use `operationId`), use the names it generated and record that in the commit body.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/api test && pnpm --filter @shop/admin typecheck`
Expected: PASS, including "matches the committed openapi.json". Open `http://localhost:4000/api/docs` with `pnpm --filter @shop/api dev` running and check the "Catalog admin" group shows 19 operations with descriptions.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/admin/src/lib/api
git commit -m "docs(api): document every catalog admin route in swagger; generate the admin client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Admin foundation: drag and drop, optimistic order, errors, navigation

**Files:**

- Modify: `apps/admin/package.json` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Create: `packages/ui/src/textarea.tsx`; modify `packages/ui/package.json` (export `./textarea`)
- Move: `apps/admin/src/features/team/api-error.ts` → `apps/admin/src/lib/api/error-message.ts` (update the team imports)
- Create: `apps/admin/src/lib/api/error-message.test.ts`
- Create: `apps/admin/src/features/catalog/lib/optimistic-order.ts`, `optimistic-order.test.ts`
- Create: `apps/admin/src/features/catalog/components/sortable-list.tsx`, `sortable-list.test.tsx`
- Modify: `apps/admin/src/config/nav.ts`, `apps/admin/src/app/(shell)/_components/nav.test.tsx`

**Interfaces:**

- Produces: `apiErrorMessage(error: unknown): string` from `@/lib/api/error-message`; `useOptimisticOrder<T extends {id: string}>(items: readonly T[], save: (ids: string[]) => Promise<{error?: unknown}>): {items: T[]; move: (ids: string[]) => Promise<void>; error: string | null}`; `<SortableList items label direction? disabled? className? itemClassName? onMove={(ids, from, to) => void}>{(item, handle) => ReactNode}</SortableList>` with `handle` spread onto a drag-handle button; `Textarea` from `@shop/ui/textarea`.

- [ ] **Step 1: Check the library API and install**

Context7 `/clauderic/dnd-kit`: `DndContext`, `useSensors`, `PointerSensor`, `KeyboardSensor`, `closestCenter`, `SortableContext`, `useSortable`, `arrayMove`, `sortableKeyboardCoordinates`, `verticalListSortingStrategy`, `horizontalListSortingStrategy`, `CSS.Transform` from `@dnd-kit/utilities`, `accessibility.screenReaderInstructions`.
Run: `pnpm --filter @shop/admin add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Write the failing tests**

`apps/admin/src/lib/api/error-message.test.ts`:

```ts
import {apiErrorMessage} from './error-message'

describe('apiErrorMessage', () => {
  it.each([
    ['stale', 'Someone else changed this. Reload the page to see their version.'],
    ['in_use', 'This is still in use. Move or delete what uses it first.'],
    ['incomplete', 'Add both prices and both translations before enabling.'],
    ['slug_locked', 'Disable it first: the slug and server are in shoppers’ links and carts.'],
    ['slug_taken', 'That slug is already used.'],
    ['rcon_host_private', 'Use the game server’s public address, not an internal one.'],
    ['rcon_key_missing', 'RCON is not configured on the server (RCON_ENCRYPTION_KEY).'],
    ['role_in_use', 'This role is still assigned to admins or open invites. Move them first.']
  ])('explains %s', (code, text) => {
    expect(apiErrorMessage({status: 409, data: {message: code}})).toBe(text)
  })

  it('adds the counts of an in_use answer', () => {
    expect(apiErrorMessage({status: 409, data: {message: 'in_use', issues: {products: 3}}})).toBe(
      'This is still in use: 3 products. Move or delete them first.'
    )
  })
})
```

`optimistic-order.test.ts`:

```ts
import {act, renderHook} from '@testing-library/react'

import {useOptimisticOrder} from './optimistic-order'

const a = {id: 'a'}
const b = {id: 'b'}
const c = {id: 'c'}

describe('useOptimisticOrder', () => {
  it('shows the new order at once and keeps it until the server list arrives', async () => {
    let resolve: (r: {error?: unknown}) => void = () => undefined
    const save = jest.fn(() => new Promise<{error?: unknown}>(r => (resolve = r)))
    const {result, rerender} = renderHook(({items}) => useOptimisticOrder(items, save), {
      initialProps: {items: [a, b, c]}
    })
    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.move(['c', 'a', 'b'])
    })
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    await act(async () => {
      resolve({})
      await done
    })
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    rerender({items: [c, a, b]})
    expect(result.current.items.map(i => i.id)).toEqual(['c', 'a', 'b'])
    expect(save).toHaveBeenCalledWith(['c', 'a', 'b'])
  })

  it('puts the items back and explains why when the save fails', async () => {
    const save = jest.fn(() => Promise.resolve({error: {status: 409, data: {message: 'stale'}}}))
    const {result} = renderHook(() => useOptimisticOrder([a, b, c], save))
    await act(async () => {
      await result.current.move(['b', 'a', 'c'])
    })
    expect(result.current.items.map(i => i.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.error).toMatch(/Someone else changed this/)
  })
})
```

`sortable-list.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react'

import {SortableList} from './sortable-list'

describe('SortableList', () => {
  it('renders a labelled list with a keyboard-focusable handle per item', () => {
    render(
      <SortableList
        label="Servers"
        items={[
          {id: 'a', name: 'Alpha'},
          {id: 'b', name: 'Beta'}
        ]}
        onMove={jest.fn()}>
        {(item, handle) => (
          <>
            <button type="button" aria-label={`Move ${item.name}`} {...handle}>
              ⠿
            </button>
            {item.name}
          </>
        )}
      </SortableList>
    )
    expect(screen.getByRole('list', {name: 'Servers'})).toBeInTheDocument()
    const handle = screen.getByRole('button', {name: 'Move Alpha'})
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it('has no handles to drag when disabled', () => {
    render(
      <SortableList label="Servers" disabled items={[{id: 'a'}]} onMove={jest.fn()}>
        {(item, handle) => <button type="button" aria-label={`Move ${item.id}`} {...handle} />}
      </SortableList>
    )
    expect(screen.getByRole('button', {name: 'Move a'})).toHaveAttribute('aria-disabled', 'true')
  })
})
```

Keyboard dragging needs real layout, so it is covered by the e2e in Task 15.

Update `nav.test.tsx` so a `SUPPORT` admin (no permissions) sees a `Catalog` link.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @shop/admin test`
Expected: FAIL: modules not found; no Catalog link.

- [ ] **Step 4: Implement**

`packages/ui/src/textarea.tsx`:

```tsx
import type * as React from 'react'

import {cn} from './lib/utils'

function Textarea({className, ...props}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input bg-background placeholder:text-muted-foreground flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export {Textarea}
```

Export `"./textarea"` in `packages/ui/package.json` the same way as `./input`.

`apps/admin/src/lib/api/error-message.ts` (moved file, extended):

```ts
const MESSAGES: Record<string, string | undefined> = {
  owner_protected: 'The owner and system roles cannot be changed this way.',
  cannot_grant: 'You can only give out permissions you hold yourself.',
  forbidden: 'You do not have permission to do that.',
  user_exists: 'That person already has an admin account.',
  invite_closed: 'That invite was already accepted or cancelled.',
  role_in_use: 'This role is still assigned to admins or open invites. Move them first.',
  role_name_taken: 'A role with that name already exists.',
  mail_failed: 'The invite was created but the email could not be sent. Use Resend to try again.',
  unknown_role: 'That role no longer exists. Refresh and try again.',
  stale: 'Someone else changed this. Reload the page to see their version.',
  in_use: 'This is still in use. Move or delete what uses it first.',
  incomplete: 'Add both prices and both translations before enabling.',
  slug_locked: 'Disable it first: the slug and server are in shoppers’ links and carts.',
  slug_taken: 'That slug is already used.',
  category_not_on_server: 'Attach that category to the server first.',
  unknown_category: 'That category no longer exists. Refresh and try again.',
  rcon_host_private: 'Use the game server’s public address, not an internal one.',
  rcon_host_unresolvable: 'That host name does not resolve. Check it for typos.',
  rcon_not_configured: 'Set host, port and password first.',
  rcon_key_missing: 'RCON is not configured on the server (RCON_ENCRYPTION_KEY).'
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`

/** Turns an RTK Query error into the sentence shown to the admin. */
export function apiErrorMessage(error: unknown): string {
  const e = error as
    {status?: unknown; data?: {message?: unknown; issues?: Record<string, unknown>}} | undefined
  const code = typeof e?.data?.message === 'string' ? e.data.message : undefined
  if (code === 'in_use' && e?.data?.issues) {
    const counts = Object.entries(e.data.issues)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
      .map(([what, n]) => plural(n, what.replace(/s$/, '')))
    if (counts.length > 0)
      return `This is still in use: ${counts.join(', ')}. Move or delete them first.`
  }
  const known = code ? MESSAGES[code] : undefined
  if (known) return known
  if (e?.status === 404) return 'That item no longer exists. Refresh the page.'
  if (e?.status === 429) return 'Too many requests. Wait a moment and try again.'
  return 'Something went wrong. Try again.'
}
```

Delete `features/team/api-error.ts`; change its imports in `features/team/components/*` to `@/lib/api/error-message`.

`optimistic-order.ts`:

```ts
import {apiErrorMessage} from '@/lib/api/error-message'
import {useState} from 'react'

/**
 * Shows a dropped item in its new place at once. The pending order is tied to the server order it
 * was made from: when a new server list arrives (the save landed) it is dropped by itself; a
 * failed save drops it at once, so the list snaps back and the error says why.
 */
export function useOptimisticOrder<T extends {id: string}>(
  items: readonly T[],
  save: (ids: string[]) => Promise<{error?: unknown}>
) {
  const base = items.map(i => i.id).join('\n')
  const [pending, setPending] = useState<{base: string; ids: string[]} | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordered =
    pending?.base === base ? pending.ids.flatMap(id => items.filter(i => i.id === id)) : [...items]

  async function move(ids: string[]) {
    setError(null)
    setPending({base, ids})
    const result = await save(ids)
    if (result.error) {
      setPending(null)
      setError(apiErrorMessage(result.error))
    }
  }

  return {items: ordered, move, error}
}
```

`sortable-list.tsx`:

```tsx
'use client'

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {HTMLAttributes, ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

/** Spread onto the drag handle (a button): pointer, touch and keyboard (space, arrows, space). */
export type DragHandleProps = HTMLAttributes<HTMLElement>

type Props<T extends {id: string}> = {
  items: readonly T[]
  /** Accessible name of the list, e.g. "Servers". */
  label: string
  /** New id order, plus the moved item's old and new index (for `useFieldArray().move`). */
  onMove: (ids: string[], from: number, to: number) => void
  direction?: 'vertical' | 'horizontal'
  disabled?: boolean
  className?: string
  itemClassName?: string
  children: (item: T, handle: DragHandleProps) => ReactNode
}

export function SortableList<T extends {id: string}>({
  items,
  label,
  onMove,
  direction = 'vertical',
  disabled = false,
  className,
  itemClassName,
  children
}: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
  )
  const ids = items.map(i => i.id)

  function onDragEnd({active, over}: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    onMove(arrayMove(ids, from, to), from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: `To move an item in ${label}, press space, use the arrow keys, then press space again. Escape cancels.`
        }
      }}>
      <SortableContext
        items={ids}
        disabled={disabled}
        strategy={
          direction === 'vertical' ? verticalListSortingStrategy : horizontalListSortingStrategy
        }>
        <ul aria-label={label} className={cn(direction === 'horizontal' && 'flex', className)}>
          {items.map(item => (
            <SortableItem key={item.id} id={item.id} className={itemClassName}>
              {handle => children(item, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  className,
  children
}: {
  id: string
  className?: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      data-dragging={isDragging || undefined}
      className={cn('relative data-[dragging]:z-10 data-[dragging]:opacity-80', className)}>
      {children({...attributes, ...listeners} as DragHandleProps)}
    </li>
  )
}
```

`config/nav.ts`: add `{href: '/catalog', label: 'Catalog'}` after Home. Make the nav mark `/catalog/...` sub-pages current: in `nav.tsx` use `pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @shop/admin test && pnpm --filter @shop/admin typecheck && pnpm --filter @shop/ui typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin packages/ui pnpm-lock.yaml
git commit -m "feat(admin): sortable lists, optimistic order and catalog error messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `/catalog` board and `/catalog/categories`

**Files:**

- Create: `apps/admin/src/features/catalog/components/catalog-board.tsx`, `catalog-board.test.tsx`
- Create: `apps/admin/src/features/catalog/components/categories-table.tsx`, `categories-table.test.tsx`
- Create: `apps/admin/src/features/catalog/schemas.ts` (category form schema here; product and server forms add theirs in Tasks 13–14)
- Create: `apps/admin/src/app/(shell)/catalog/page.tsx`, `apps/admin/src/app/(shell)/catalog/categories/page.tsx`

**Interfaces:**

- Consumes: Task 10 hooks; Task 11 `SortableList`, `useOptimisticOrder`, `apiErrorMessage`; `fromMinor` from `@shop/shared/catalog-admin`.
- Produces: `<CatalogBoard canEdit: boolean />`, `<CategoriesTable canEdit: boolean />`, `CategoryFormSchema`.

- [ ] **Step 1: Write the failing tests**

`catalog-board.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, within} from '@testing-library/react'

import {CatalogBoard} from './catalog-board'

const server = (
  id: string,
  name: string,
  categories: {id: string; slug: string; name: string}[]
) => ({
  id,
  slug: name.toLowerCase(),
  name,
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  sort: 0,
  version: 1,
  productCount: 2,
  categories,
  rcon: null,
  rconPasswordSet: false
})
const ranks = {id: 'c-ranks', slug: 'ranks', name: 'Ranks'}
const kits = {id: 'c-kits', slug: 'kits', name: 'Kits'}
const product = (id: string, name: string, extra: object = {}) => ({
  id,
  version: 1,
  sort: 0,
  serverId: 's1',
  categoryId: 'c-ranks',
  slug: id,
  kind: 'PERMANENT',
  mark: name,
  icon: 'crown',
  name,
  isActive: true,
  prices: {EUR: 499, PLN: 2199},
  missing: [],
  ...extra
})

function mockApi(
  onWrite: (url: URL, init: RequestInit | undefined) => Response = () => Response.json({})
) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    if (req.method !== 'GET') return Promise.resolve(onWrite(url, init))
    if (url.pathname === '/api/admin/catalog/servers')
      return Promise.resolve(
        Response.json([server('s1', 'Survival', [ranks, kits]), server('s2', 'Anarchy', [])])
      )
    if (url.pathname === '/api/admin/catalog/categories') return Promise.resolve(Response.json([]))
    return Promise.resolve(
      Response.json([
        product('p1', 'VIP'),
        product('p2', 'Elite', {
          isActive: false,
          missing: ['price.PLN'],
          prices: {EUR: 999, PLN: null}
        })
      ])
    )
  })
}

describe('CatalogBoard', () => {
  it('shows server tabs, the first server’s categories and its products with badges', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    expect(await screen.findByRole('list', {name: 'Servers'})).toHaveTextContent('Survival')
    const ranksList = await screen.findByRole('list', {name: 'Products in Ranks'})
    expect(within(ranksList).getByText('VIP')).toBeInTheDocument()
    expect(within(ranksList).getByText('4.99 €')).toBeInTheDocument()
    const elite = within(ranksList).getByText('Elite').closest('li') as HTMLElement
    expect(elite).toHaveTextContent('Disabled')
    expect(elite).toHaveTextContent('Incomplete')
    expect(screen.getByRole('link', {name: '+ Product in Ranks'})).toHaveAttribute(
      'href',
      '/catalog/products/new?serverId=s1&categoryId=c-ranks'
    )
  })

  it('switches server', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('tab', {name: 'Anarchy'}))
    expect(await screen.findByText('No categories yet. Attach one below.')).toBeInTheDocument()
  })

  it('explains why a category cannot be detached', async () => {
    mockApi(() =>
      Response.json({statusCode: 409, message: 'in_use', issues: {products: 2}}, {status: 409})
    )
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('button', {name: 'Detach Ranks'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This is still in use: 2 products. Move or delete them first.'
    )
  })

  it('hides editing for read-only admins', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit={false} />)
    await screen.findByRole('list', {name: 'Servers'})
    expect(screen.queryByRole('link', {name: /^\+ /})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /^Detach/})).not.toBeInTheDocument()
  })
})
```

`categories-table.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {CategoriesTable} from './categories-table'

const ranks = {
  id: 'c1',
  slug: 'ranks',
  names: {en: 'Ranks', pl: 'Rangi'},
  version: 1,
  productCount: 6,
  servers: [{id: 's1', name: 'Survival'}]
}

describe('CategoriesTable', () => {
  it('lists categories with both names, servers and product counts', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([ranks]))
    renderWithStore(<CategoriesTable canEdit />)
    const row = (await screen.findByText('Rangi')).closest('tr') as HTMLElement
    expect(row).toHaveTextContent('ranks')
    expect(row).toHaveTextContent('Survival')
    expect(row).toHaveTextContent('6')
  })

  it('creates a category with both names', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      return Promise.resolve(
        req.method === 'POST' ? Response.json(ranks, {status: 201}) : Response.json([])
      )
    })
    renderWithStore(<CategoriesTable canEdit />)
    fireEvent.change(await screen.findByLabelText('Slug'), {target: {value: 'tools'}})
    fireEvent.change(screen.getByLabelText('English name'), {target: {value: 'Tools'}})
    fireEvent.change(screen.getByLabelText('Polish name'), {target: {value: 'Narzędzia'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add category'}))
    await waitFor(() => {
      const post = fetchMock.mock.calls.map(([r]) => r as Request).find(r => r.method === 'POST')
      expect(post).toBeDefined()
    })
  })

  it('shows a field error for a bad slug', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([]))
    renderWithStore(<CategoriesTable canEdit />)
    fireEvent.change(await screen.findByLabelText('Slug'), {target: {value: 'Bad Slug'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add category'}))
    expect(
      await screen.findByText('Use 1–40 lowercase letters, digits or dashes')
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/admin test -- features/catalog`
Expected: FAIL: components missing.

- [ ] **Step 3: Implement**

`apps/admin/src/features/catalog/schemas.ts`:

```ts
import * as v from 'valibot'

import {SLUG_PATTERN} from '@shop/shared/catalog-admin'

export const SlugField = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, 'Use 1–40 lowercase letters, digits or dashes')
)
const Name = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a name'),
  v.maxLength(40, 'Use at most 40 characters')
)

export const CategoryFormSchema = v.object({slug: SlugField, en: Name, pl: Name})
export type CategoryForm = v.InferOutput<typeof CategoryFormSchema>
```

`catalog-board.tsx` (Client Component):

```tsx
'use client'

import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type ListCatalogProductsApiResponse,
  type ListCatalogServersApiResponse,
  useListCatalogCategoriesQuery,
  useListCatalogProductsQuery,
  useListCatalogServersQuery,
  useOrderCatalogProductsMutation,
  useOrderCatalogServersMutation,
  useSetCatalogServerCategoriesMutation
} from '@/lib/api/generated'
import Link from 'next/link'
import {useState} from 'react'

import {fromMinor} from '@shop/shared/catalog-admin'
import {Button} from '@shop/ui/button'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

import {useOptimisticOrder} from '../lib/optimistic-order'
import {type DragHandleProps, SortableList} from './sortable-list'

type Server = ListCatalogServersApiResponse[number]
type Product = ListCatalogProductsApiResponse[number]

function Handle({label, handle}: {label: string; handle: DragHandleProps}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}`}
      className="text-muted-foreground hover:bg-accent cursor-grab touch-none rounded px-1 focus-visible:ring-2 focus-visible:outline-none"
      {...handle}>
      ⠿
    </button>
  )
}

export function CatalogBoard({canEdit}: {canEdit: boolean}) {
  const servers = useListCatalogServersQuery()
  const [orderServers] = useOrderCatalogServersMutation()
  const tabs = useOptimisticOrder(servers.data ?? [], ids => orderServers({body: {ids}}))
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (servers.isLoading) return <p>Loading catalog…</p>
  if (servers.isError) return <p role="alert">Could not load the catalog. Refresh the page.</p>
  const selected = tabs.items.find(s => s.id === selectedId) ?? tabs.items[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Server">
          <SortableList
            label="Servers"
            direction="horizontal"
            disabled={!canEdit}
            items={tabs.items}
            className="gap-2"
            onMove={ids => void tabs.move(ids)}>
            {(s, handle) => (
              <span className="flex items-center gap-1 rounded-md border px-2 py-1">
                {canEdit && <Handle label={s.name} handle={handle} />}
                <button
                  type="button"
                  role="tab"
                  aria-selected={s.id === selected?.id}
                  onClick={() => {
                    setSelectedId(s.id)
                  }}
                  className="rounded px-2 py-1 text-sm aria-selected:font-semibold"
                  style={
                    s.id === selected?.id ? {background: s.accent, color: s.onAccent} : undefined
                  }>
                  {s.name}
                  {!s.isActive && <span className="ml-1 text-xs">(disabled)</span>}
                </button>
              </span>
            )}
          </SortableList>
        </div>
        {canEdit && (
          <Link href="/catalog/servers/new" className="text-sm underline">
            + Server
          </Link>
        )}
        <Link href="/catalog/categories" className="ml-auto text-sm underline">
          Manage categories
        </Link>
      </div>
      {tabs.error && <p role="alert">{tabs.error}</p>}
      {selected && <ServerColumn server={selected} canEdit={canEdit} />}
      <p className="text-muted-foreground text-sm">Changes are live on the site within a minute.</p>
    </div>
  )
}

function ServerColumn({server, canEdit}: {server: Server; canEdit: boolean}) {
  const [setCategories] = useSetCatalogServerCategoriesMutation()
  const allCategories = useListCatalogCategoriesQuery()
  const products = useListCatalogProductsQuery({serverId: server.id})
  const categories = useOptimisticOrder(server.categories, ids =>
    setCategories({id: server.id, body: {categoryIds: ids}})
  )
  const [error, setError] = useState<string | null>(null)
  const [attach, setAttach] = useState('')

  async function save(ids: string[]) {
    setError(null)
    const result = await setCategories({id: server.id, body: {categoryIds: ids}})
    if (result.error) setError(apiErrorMessage(result.error))
  }

  const unattached = (allCategories.data ?? []).filter(
    c => !server.categories.some(sc => sc.id === c.id)
  )

  return (
    <section aria-label={server.name} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{server.name}</h2>
        <Link href={`/catalog/servers/${server.id}`} className="text-sm underline">
          Server settings
        </Link>
      </div>
      {(error ?? categories.error) && <p role="alert">{error ?? categories.error}</p>}
      {categories.items.length === 0 ? (
        <p className="text-muted-foreground">No categories yet. Attach one below.</p>
      ) : (
        <SortableList
          label={`Categories of ${server.name}`}
          disabled={!canEdit}
          items={categories.items}
          className="flex flex-col gap-4"
          onMove={ids => void categories.move(ids)}>
          {(category, handle) => (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2">
                {canEdit && <Handle label={category.name} handle={handle} />}
                <h3 className="font-medium">{category.name}</h3>
                {canEdit && (
                  <>
                    <Link
                      href={`/catalog/products/new?serverId=${server.id}&categoryId=${category.id}`}
                      aria-label={`+ Product in ${category.name}`}
                      className="ml-auto text-sm underline">
                      + Product
                    </Link>
                    <Button
                      variant="outline"

                      aria-label={`Detach ${category.name}`}
                      onClick={() =>
                        void save(
                          server.categories.filter(c => c.id !== category.id).map(c => c.id)
                        )
                      }>
                      Detach
                    </Button>
                  </>
                )}
              </div>
              <ProductList
                serverId={server.id}
                categoryId={category.id}
                categoryName={category.name}
                products={(products.data ?? []).filter(p => p.categoryId === category.id)}
                canEdit={canEdit}
              />
            </div>
          )}
        </SortableList>
      )}
      {canEdit && unattached.length > 0 && (
        <form
          className="flex items-end gap-2"
          onSubmit={e => {
            e.preventDefault()
            if (attach) void save([...server.categories.map(c => c.id), attach])
            setAttach('')
          }}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="attach-category">Attach category</Label>
            <Select
              id="attach-category"
              value={attach}
              onChange={e => {
                setAttach(e.target.value)
              }}>
              <option value="">Choose…</option>
              {unattached.map(c => (
                <option key={c.id} value={c.id}>
                  {c.names.en}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={!attach}>
            Attach
          </Button>
        </form>
      )}
    </section>
  )
}

function ProductList({
  serverId,
  categoryId,
  categoryName,
  products,
  canEdit
}: {
  serverId: string
  categoryId: string
  categoryName: string
  products: Product[]
  canEdit: boolean
}) {
  const [order] = useOrderCatalogProductsMutation()
  const list = useOptimisticOrder(products, ids => order({serverId, categoryId, body: {ids}}))
  if (products.length === 0) return <p className="text-muted-foreground text-sm">No products.</p>
  return (
    <>
      {list.error && <p role="alert">{list.error}</p>}
      <SortableList
        label={`Products in ${categoryName}`}
        disabled={!canEdit}
        items={list.items}
        className="flex flex-col gap-1"
        onMove={ids => void list.move(ids)}>
        {(p, handle) => (
          <div className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1">
            {canEdit && <Handle label={p.name} handle={handle} />}
            <span className="text-muted-foreground w-12 text-xs">{p.mark}</span>
            <Link href={`/catalog/products/${p.id}`} className="font-medium hover:underline">
              {p.name}
            </Link>
            <span className="ml-auto text-sm">
              {p.prices.EUR === null ? '—' : `${fromMinor(p.prices.EUR)} €`}
            </span>
            {!p.isActive && <span className="bg-muted rounded px-1.5 text-xs">Disabled</span>}
            {p.missing.length > 0 && (
              <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">Incomplete</span>
            )}
          </div>
        )}
      </SortableList>
    </>
  )
}
```

Use the generated hook argument names (`serverId`, `categoryId`, `body`, `id`); fix them if codegen differs. `@shop/ui/button` has only `variant` `default` | `outline` and `size` `default` | `lg`.

`categories-table.tsx` (Client Component):

```tsx
'use client'

import {CategoryFormSchema} from '@/features/catalog/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useCreateCatalogCategoryMutation,
  useDeleteCatalogCategoryMutation,
  useListCatalogCategoriesQuery,
  useUpdateCatalogCategoryMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

export function CategoriesTable({canEdit}: {canEdit: boolean}) {
  const categories = useListCatalogCategoriesQuery()
  const [create, {isLoading: creating}] = useCreateCatalogCategoryMutation()
  const [update] = useUpdateCatalogCategoryMutation()
  const [remove] = useDeleteCatalogCategoryMutation()
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(CategoryFormSchema),
    defaultValues: {slug: '', en: '', pl: ''}
  })
  const {errors} = useFormState({control})

  if (categories.isLoading) return <p>Loading categories…</p>
  if (categories.isError) return <p role="alert">Could not load categories. Refresh the page.</p>

  async function run(action: Promise<{error?: unknown}>) {
    setError(null)
    const result = await action
    if (result.error) setError(apiErrorMessage(result.error))
    return !result.error
  }

  const onCreate = handleSubmit(async values => {
    if (await run(create({body: {slug: values.slug, names: {en: values.en, pl: values.pl}}})))
      reset()
  })

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>English</TableHead>
            <TableHead>Polish</TableHead>
            <TableHead>Servers</TableHead>
            <TableHead>Products</TableHead>
            {canEdit && <TableHead className="sr-only">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(categories.data ?? []).map(c =>
            editing === c.id ? (
              <EditRow
                key={c.id}
                category={c}
                onCancel={() => {
                  setEditing(null)
                }}
                onSave={async values => {
                  if (
                    await run(
                      update({
                        id: c.id,
                        body: {
                          slug: values.slug,
                          names: {en: values.en, pl: values.pl},
                          version: c.version
                        }
                      })
                    )
                  )
                    setEditing(null)
                }}
              />
            ) : (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                <TableCell>{c.names.en}</TableCell>
                <TableCell>{c.names.pl}</TableCell>
                <TableCell>{c.servers.map(s => s.name).join(', ') || '—'}</TableCell>
                <TableCell>{c.productCount}</TableCell>
                {canEdit && (
                  <TableCell className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(c.id)
                      }}>
                      Rename
                    </Button>
                    {confirming === c.id ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirming(null)
                          void run(remove({id: c.id, version: c.version}))
                        }}>
                        Confirm delete
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirming(c.id)
                        }}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
      {canEdit && (
        <form
          onSubmit={e => void onCreate(e)}
          className="flex flex-wrap items-end gap-3"
          noValidate>
          {(['slug', 'en', 'pl'] as const).map(field => (
            <div key={field} className="flex flex-col gap-1">
              <Label htmlFor={`new-${field}`}>
                {{slug: 'Slug', en: 'English name', pl: 'Polish name'}[field]}
              </Label>
              <Input
                id={`new-${field}`}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={errors[field] ? `new-${field}-error` : undefined}
                {...register(field)}
              />
              {errors[field] && (
                <p id={`new-${field}-error`} className="text-destructive text-xs">
                  {errors[field].message}
                </p>
              )}
            </div>
          ))}
          <Button type="submit" disabled={creating}>
            Add category
          </Button>
        </form>
      )}
    </div>
  )
}
```

`EditRow` is a small component in the same file: a `TableRow` with three `Input`s (`aria-label` "Slug", "English name", "Polish name"), its own `useForm` with `CategoryFormSchema` and defaults from the category, and Save / Cancel buttons calling `onSave(values)` / `onCancel()`. `@shop/ui/button` has only `variant` `default` | `outline` and `size` `default` | `lg`; do not invent others.

Pages:

`apps/admin/src/app/(shell)/catalog/page.tsx`:

```tsx
import {CatalogBoard} from '@/features/catalog/components/catalog-board'
import {requireMe} from '@/lib/session'

import {hasPermission} from '@shop/shared/access'

export default async function CatalogPage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>
      <CatalogBoard canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
```

`apps/admin/src/app/(shell)/catalog/categories/page.tsx`: the same shape with heading "Categories" and `<CategoriesTable canEdit={…} />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/admin test && pnpm --filter @shop/admin typecheck && pnpm --filter @shop/admin lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): catalog board with drag-and-drop order, and the categories page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Product editor

**Files:**

- Create: `apps/admin/src/features/catalog/lib/product-form.ts`, `product-form.test.ts`
- Modify: `apps/admin/src/features/catalog/schemas.ts` (`ProductFormSchema`)
- Create: `apps/admin/src/features/catalog/components/product-editor.tsx`, `product-editor.test.tsx`, `sections-editor.tsx`
- Create: `apps/admin/src/app/(shell)/catalog/products/new/page.tsx`, `apps/admin/src/app/(shell)/catalog/products/[id]/page.tsx`

**Interfaces:**

- Consumes: Task 10 hooks; Task 11 `SortableList`, `Textarea`, `apiErrorMessage`; `toMinor`, `fromMinor`, `missingForActive`, `hasOnlyNickPlaceholder` from `@shop/shared/catalog-admin`.
- Produces: `ProductForm` type; `emptyProductForm(serverId?: string, categoryId?: string): ProductForm`; `productToForm(p: AdminProduct): ProductForm`; `formToCreate(f: ProductForm): ProductCreate`; `formToUpdate(f: ProductForm, version: number): ProductUpdate`; `<ProductEditor id?: string; serverId?: string; categoryId?: string; canEdit: boolean />`.

- [ ] **Step 1: Write the failing tests**

`product-form.test.ts`:

```ts
import {missingForActive} from '@shop/shared/catalog-admin'

import {emptyProductForm, formToCreate, formToUpdate, productToForm} from './product-form'

const product = {
  id: 'p1',
  version: 3,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'TIMED' as const,
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown' as const,
  isActive: true,
  grantCommands: ['lp user {nick} parent add vip', 'say hi {nick}'],
  revokeCommands: ['lp user {nick} parent remove vip'],
  prices: {EUR: 499, PLN: 2199},
  translations: {
    en: {
      name: 'VIP',
      description: 'Fly',
      sections: [{title: 'Perks', entries: [{cmd: '/fly', cooldown: '5m'}]}]
    },
    pl: null
  },
  missing: ['translation.pl' as const]
}

describe('product form mapping', () => {
  it('round-trips a product through the form', () => {
    const form = productToForm(product)
    expect(form.prices).toEqual({EUR: '4.99', PLN: '21.99'})
    expect(form.grant).toBe('lp user {nick} parent add vip\nsay hi {nick}')
    expect(form.durationDays).toBe('30')
    const body = formToUpdate(form, 3)
    expect(body).toMatchObject({
      version: 3,
      isActive: true,
      durationDays: 30,
      grantCommands: product.grantCommands,
      prices: {EUR: 499, PLN: 2199},
      translations: {en: product.translations.en, pl: null}
    })
  })

  it('treats an empty translation tab as missing and drops blank lines and entry fields', () => {
    const form = emptyProductForm('s1', 'c1')
    form.slug = 'kit'
    form.mark = 'KIT'
    form.grant = '\n give {nick} bread 1 \n\n'
    form.prices.EUR = '1'
    form.translations.en = {
      name: 'Kit',
      description: '',
      sections: [{title: 'X', entries: [{cmd: '', text: 'Bread', cooldown: ''}]}]
    }
    const body = formToCreate(form)
    expect(body.grantCommands).toEqual(['give {nick} bread 1'])
    expect(body.durationDays).toBeNull()
    expect(body.translations.pl).toBeNull()
    expect(body.translations.en?.sections).toEqual([{title: 'X', entries: [{text: 'Bread'}]}])
    expect(missingForActive(body)).toEqual(['price.PLN', 'translation.pl'])
  })
})
```

`product-editor.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {ProductEditor} from './product-editor'

jest.mock('next/navigation', () => ({useRouter: () => ({replace: jest.fn(), push: jest.fn()})}))

const servers = [
  {
    id: 's1',
    slug: 'survival',
    name: 'Survival',
    accent: '#ff6b1a',
    onAccent: '#000000',
    isActive: true,
    sort: 0,
    version: 1,
    productCount: 1,
    categories: [{id: 'c1', slug: 'ranks', name: 'Ranks'}],
    rcon: null,
    rconPasswordSet: false
  }
]
const draft = {
  id: 'p1',
  version: 1,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'probe',
  kind: 'PERMANENT',
  durationDays: null,
  mark: 'PRB',
  icon: 'crown',
  isActive: false,
  grantCommands: [],
  revokeCommands: [],
  prices: {EUR: 499, PLN: null},
  translations: {en: {name: 'Probe', description: '', sections: []}, pl: null},
  missing: ['price.PLN', 'translation.pl']
}

function mockApi(patch: (body: unknown) => Response = () => Response.json(draft)) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    if (req.method === 'PATCH') return patch(await req.json())
    if (url.pathname === '/api/admin/catalog/servers') return Response.json(servers)
    if (url.pathname === '/api/admin/catalog/products/p1') return Response.json(draft)
    return Response.json([])
  })
}

describe('ProductEditor', () => {
  it('lists what is missing and keeps "Enabled" off until it is complete', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    expect(
      await screen.findByText('Missing to enable: PLN price, Polish translation')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Enabled')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Price PLN'), {target: {value: '21.99'}})
    fireEvent.click(screen.getByRole('tab', {name: 'PL'}))
    fireEvent.change(screen.getByLabelText('Name (PL)'), {target: {value: 'Sonda'}})
    expect(await screen.findByLabelText('Enabled')).toBeEnabled()
  })

  it('refuses a command with another placeholder before saving', async () => {
    const fetchMock = mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    fireEvent.change(await screen.findByLabelText('Grant commands'), {
      target: {value: 'give {player} 1'}
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByText('Only the {nick} placeholder is allowed')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'PATCH')).toBe(false)
  })

  it('sends minor units and the version, and keeps the form on a 409 stale', async () => {
    let sent: unknown
    mockApi(body => {
      sent = body
      return Response.json({statusCode: 409, message: 'stale'}, {status: 409})
    })
    renderWithStore(<ProductEditor id="p1" canEdit />)
    fireEvent.change(await screen.findByLabelText('Price EUR'), {target: {value: '5,49'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this')
    await waitFor(() => {
      expect(sent).toMatchObject({version: 1, prices: {EUR: 549, PLN: null}})
    })
    expect(screen.getByLabelText('Price EUR')).toHaveValue('5,49')
  })

  it('is read-only without catalog.write', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit={false} />)
    expect(await screen.findByLabelText('Price EUR')).toBeDisabled()
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/admin test -- features/catalog`
Expected: FAIL: modules missing.

- [ ] **Step 3: Implement**

Add to `schemas.ts`:

```ts
import {PRODUCT_ICONS, PRODUCT_KINDS} from '@shop/shared/catalog'
import {hasOnlyNickPlaceholder, toMinor} from '@shop/shared/catalog-admin'

const PriceText = v.pipe(
  v.string(),
  v.trim(),
  v.check(t => t === '' || toMinor(t) !== null, 'Use a price like 9.99')
)
const CommandLines = v.pipe(
  v.string(),
  v.check(
    t => t.split('\n').every(line => hasOnlyNickPlaceholder(line)),
    'Only the {nick} placeholder is allowed'
  ),
  v.check(
    t => t.split('\n').every(line => line.trim().length <= 200),
    'Use at most 200 characters per command'
  )
)
const EntryForm = v.object({cmd: v.string(), text: v.string(), cooldown: v.string()})
const SectionForm = v.object({title: v.string(), entries: v.array(EntryForm)})
const TranslationForm = v.object({
  name: v.pipe(v.string(), v.maxLength(60, 'Use at most 60 characters')),
  description: v.pipe(v.string(), v.maxLength(2000, 'Use at most 2000 characters')),
  sections: v.array(SectionForm)
})

export const ProductFormSchema = v.pipe(
  v.object({
    serverId: v.pipe(v.string(), v.minLength(1, 'Choose a server')),
    categoryId: v.pipe(v.string(), v.minLength(1, 'Choose a category')),
    slug: SlugField,
    kind: v.picklist(PRODUCT_KINDS),
    durationDays: v.pipe(v.string(), v.trim()),
    mark: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, 'Enter a mark'),
      v.maxLength(12, 'Use at most 12 characters')
    ),
    icon: v.picklist(PRODUCT_ICONS),
    isActive: v.boolean(),
    grant: CommandLines,
    revoke: CommandLines,
    prices: v.object({EUR: PriceText, PLN: PriceText}),
    translations: v.object({en: TranslationForm, pl: TranslationForm})
  }),
  v.forward(
    v.partialCheck(
      [['kind'], ['durationDays']],
      f => (f.kind === 'TIMED') === /^[1-9]\d*$/.test(f.durationDays),
      'TIMED products need a number of days; other kinds leave it empty'
    ),
    ['durationDays']
  )
)
export type ProductForm = v.InferInput<typeof ProductFormSchema>
```

`lib/product-form.ts`:

```ts
import type {ProductForm} from '@/features/catalog/schemas'

import {
  type AdminProduct,
  type ProductCreate,
  type ProductUpdate,
  fromMinor,
  toMinor
} from '@shop/shared/catalog-admin'

type TranslationForm = ProductForm['translations']['en']

const blank = (): TranslationForm => ({name: '', description: '', sections: []})

export const emptyProductForm = (serverId = '', categoryId = ''): ProductForm => ({
  serverId,
  categoryId,
  slug: '',
  kind: 'PERMANENT',
  durationDays: '',
  mark: '',
  icon: 'crown',
  isActive: false,
  grant: '',
  revoke: '',
  prices: {EUR: '', PLN: ''},
  translations: {en: blank(), pl: blank()}
})

export function productToForm(p: AdminProduct): ProductForm {
  const tr = (t: AdminProduct['translations']['en']): TranslationForm =>
    t
      ? {
          name: t.name,
          description: t.description,
          sections: t.sections.map(s => ({
            title: s.title,
            entries: s.entries.map(e => ({
              cmd: e.cmd ?? '',
              text: e.text ?? '',
              cooldown: e.cooldown ?? ''
            }))
          }))
        }
      : blank()
  return {
    serverId: p.serverId,
    categoryId: p.categoryId,
    slug: p.slug,
    kind: p.kind,
    durationDays: p.durationDays === null ? '' : String(p.durationDays),
    mark: p.mark,
    icon: p.icon,
    isActive: p.isActive,
    grant: p.grantCommands.join('\n'),
    revoke: p.revokeCommands.join('\n'),
    prices: {
      EUR: p.prices.EUR === null ? '' : fromMinor(p.prices.EUR),
      PLN: p.prices.PLN === null ? '' : fromMinor(p.prices.PLN)
    },
    translations: {en: tr(p.translations.en), pl: tr(p.translations.pl)}
  }
}

const lines = (text: string) =>
  text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
const price = (text: string) => (text.trim() === '' ? null : toMinor(text))
const filled = (s: string) => (s.trim() === '' ? undefined : s.trim())

/** A tab with no name, description or sections is "no translation" (null), not an empty one. */
function translation(t: TranslationForm): ProductCreate['translations']['en'] {
  if (!t.name.trim() && !t.description.trim() && t.sections.length === 0) return null
  return {
    name: t.name.trim(),
    description: t.description.trim(),
    sections: t.sections.map(s => ({
      title: s.title.trim(),
      entries: s.entries.map(e =>
        Object.fromEntries(
          Object.entries({
            cmd: filled(e.cmd),
            text: filled(e.text),
            cooldown: filled(e.cooldown)
          }).filter(([, value]) => value !== undefined)
        )
      )
    }))
  }
}

export function formToCreate(f: ProductForm): ProductCreate {
  return {
    serverId: f.serverId,
    categoryId: f.categoryId,
    slug: f.slug.trim(),
    kind: f.kind,
    durationDays: f.kind === 'TIMED' ? Number(f.durationDays) : null,
    mark: f.mark.trim(),
    icon: f.icon,
    grantCommands: lines(f.grant),
    revokeCommands: lines(f.revoke),
    prices: {EUR: price(f.prices.EUR), PLN: price(f.prices.PLN)},
    translations: {en: translation(f.translations.en), pl: translation(f.translations.pl)}
  }
}

export const formToUpdate = (f: ProductForm, version: number): ProductUpdate => ({
  ...formToCreate(f),
  isActive: f.isActive,
  version
})
```

`sections-editor.tsx`: a Client Component taking `{locale: 'en' | 'pl'; control; register; disabled}` from the parent `useForm<ProductForm>()`. It uses `useFieldArray({control, name: \`translations.${locale}.sections\`})`and, for each section, a nested component with`useFieldArray({name: \`translations.${locale}.sections.${i}.entries\`})`. Sections and entries are rendered through `SortableList` (`label`"Sections (EN)" / "Lines of <title>"), and`onMove={(_, from, to) => move(from, to)}`calls the field array's`move`. Each section has an input "Section title", and each entry the inputs "Command", "Text" and "Cooldown", plus "Remove" buttons and "+ Section" / "+ Line" buttons. Use `field.id`from`useFieldArray` as the sortable id.

`product-editor.tsx` (Client Component), structure:

```tsx
'use client'

import {formToCreate, formToUpdate, emptyProductForm, productToForm} from '@/features/catalog/lib/product-form'
import {type ProductForm, ProductFormSchema} from '@/features/catalog/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useCreateCatalogProductMutation,
  useDeleteCatalogProductMutation,
  useGetCatalogProductQuery,
  useListCatalogServersQuery,
  useUpdateCatalogProductMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import {useForm, useFormState, useWatch} from 'react-hook-form'

import {PRODUCT_ICONS, PRODUCT_KINDS} from '@shop/shared/catalog'
import {missingForActive} from '@shop/shared/catalog-admin'
// Button, Checkbox, Input, Label, Select, Tabs*, Textarea from @shop/ui

const MISSING_LABEL = {
  'price.EUR': 'EUR price',
  'price.PLN': 'PLN price',
  'translation.en': 'English translation',
  'translation.pl': 'Polish translation'
} as const

export function ProductEditor({id, serverId, categoryId, canEdit}: {
  id?: string
  serverId?: string
  categoryId?: string
  canEdit: boolean
}) {
  const router = useRouter()
  const product = useGetCatalogProductQuery({id: id ?? ''}, {skip: !id})
  const servers = useListCatalogServersQuery()
  const [create, {isLoading: creating}] = useCreateCatalogProductMutation()
  const [update, {isLoading: updating}] = useUpdateCatalogProductMutation()
  const [remove] = useDeleteCatalogProductMutation()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<ProductForm>({
    resolver: valibotResolver(ProductFormSchema),
    defaultValues: emptyProductForm(serverId, categoryId)
  })
  // Load the stored product once; later refetches must not wipe what the admin is typing.
  const loadedId = product.data?.id
  useEffect(() => {
    if (product.data) form.reset(productToForm(product.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another product loads
  }, [loadedId])

  const values = useWatch({control: form.control}) as ProductForm
  const missing = missingForActive(formToCreate({...emptyProductForm(), ...values}))
  ...
}
```

Behaviour the component must have (the tests pin the labelled ones):

1. `id` given and `product.isLoading` → "Loading product…"; `product.isError` → alert "Could not load the product. Refresh the page."
2. A `<fieldset disabled={!canEdit}>` wraps all fields, so a read-only admin sees disabled inputs and no Save/Delete buttons.
3. Fields and labels: "Server" (`Select` of servers), "Category" (`Select` of the selected server's `categories`), "Slug", "Kind" (`PRODUCT_KINDS`), "Duration (days)" (shown only for `TIMED`), "Mark", "Icon" (`PRODUCT_ICONS`), "Enabled" (`Checkbox`, disabled while `missing.length > 0`; when the product turns incomplete, untick it with `form.setValue('isActive', false)`), "Price EUR", "Price PLN" (`inputMode="decimal"`), "Grant commands", "Revoke commands" (`Textarea`, hint "One command per line, without /. Use {nick} for the buyer’s name."), Tabs "EN" / "PL" with "Name (EN)", "Description (EN)" (`Textarea`) and `<SectionsEditor locale="en" …/>` (same for PL).
4. Above the form: when `missing.length > 0`, the text `Missing to enable: ${missing.map(m => MISSING_LABEL[m]).join(', ')}`.
5. Field errors under each field with `aria-invalid` and `aria-describedby`, as in `categories-table.tsx`.
6. Save (`type="submit"`): new → `create({body: formToCreate(values)})` then `router.replace(\`/catalog/products/${created.id}\`)`; existing → `update({id, body: formToUpdate(values, product.data.version)})`. On error show `apiErrorMessage`in`role="alert"` and keep the values; on success show "Saved. Live on the site within a minute." (`role="status"`).
7. Delete (existing only): first click shows "Confirm delete"; confirm → `remove({id, version})` → `router.push('/catalog')`.

Pages:

`catalog/products/new/page.tsx`:

```tsx
import {ProductEditor} from '@/features/catalog/components/product-editor'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<{serverId?: string; categoryId?: string}>
}) {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'catalog.write')) notFound()
  const {serverId, categoryId} = await searchParams
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductEditor serverId={serverId} categoryId={categoryId} canEdit />
    </section>
  )
}
```

`catalog/products/[id]/page.tsx`: `params: Promise<{id: string}>`, heading "Product", `<ProductEditor id={id} canEdit={hasPermission(me.permissions, 'catalog.write')} />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/admin test && pnpm --filter @shop/admin typecheck && pnpm --filter @shop/admin lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): product editor with prices, translations, sections and commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Server editor and RCON panel

**Files:**

- Modify: `apps/admin/src/features/catalog/schemas.ts` (`ServerFormSchema`, `RconFormSchema`)
- Create: `apps/admin/src/features/catalog/components/server-editor.tsx`, `server-editor.test.tsx`, `rcon-panel.tsx`, `rcon-panel.test.tsx`
- Create: `apps/admin/src/app/(shell)/catalog/servers/new/page.tsx`, `apps/admin/src/app/(shell)/catalog/servers/[id]/page.tsx`

**Interfaces:**

- Consumes: Task 10 hooks; `apiErrorMessage`.
- Produces: `<ServerEditor id?: string; canEdit: boolean; canRcon: boolean />`, `<RconPanel server: AdminServer />`.

- [ ] **Step 1: Write the failing tests**

`server-editor.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {ServerEditor} from './server-editor'

jest.mock('next/navigation', () => ({useRouter: () => ({replace: jest.fn(), push: jest.fn()})}))

const survival = {
  id: 's1',
  slug: 'survival',
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  sort: 0,
  version: 4,
  productCount: 6,
  categories: [],
  rcon: {host: 'mc.example.com', port: 25575},
  rconPasswordSet: true
}

function mockApi(
  write: (method: string, body: unknown) => Response = () => Response.json(survival)
) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') return write(req.method, await req.json().catch(() => null))
    return Response.json(survival)
  })
}

describe('ServerEditor', () => {
  it('previews the tab in the chosen colors', async () => {
    mockApi()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    const preview = await screen.findByTestId('tab-preview')
    expect(preview).toHaveStyle({background: '#ff6b1a', color: '#000000'})
    fireEvent.change(screen.getByLabelText('Accent'), {target: {value: '#2266ff'}})
    expect(preview).toHaveStyle({background: '#2266ff'})
  })

  it('locks the slug while the server is enabled', async () => {
    mockApi()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    expect(await screen.findByLabelText('Slug')).toHaveAttribute('readonly')
    expect(screen.getByText('Disable the server to change its slug.')).toBeInTheDocument()
  })

  it('saves with the version it loaded', async () => {
    let sent: unknown
    mockApi((_m, body) => {
      sent = body
      return Response.json({...survival, version: 5})
    })
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    fireEvent.change(await screen.findByLabelText('Name'), {target: {value: 'Survival+'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(sent).toMatchObject({name: 'Survival+', version: 4})
    })
  })

  it('shows the RCON panel only with server.rcon', async () => {
    mockApi()
    const {unmount} = renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    await screen.findByLabelText('Name')
    expect(screen.queryByRole('heading', {name: 'RCON'})).not.toBeInTheDocument()
    unmount()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon />)
    expect(await screen.findByRole('heading', {name: 'RCON'})).toBeInTheDocument()
  })
})
```

`rcon-panel.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {RconPanel} from './rcon-panel'

const server = {
  id: 's1',
  slug: 'survival',
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  sort: 0,
  version: 4,
  productCount: 6,
  categories: [],
  rcon: {host: 'mc.example.com', port: 25575},
  rconPasswordSet: true
}

describe('RconPanel', () => {
  it('never shows the password, only that one is set', () => {
    renderWithStore(<RconPanel server={server} />)
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByText('A password is set.')).toBeInTheDocument()
  })

  it('sends a new password only when typed', async () => {
    let sent: unknown
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      sent = await req.json()
      return Response.json(server)
    })
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Save RCON'}))
    await waitFor(() => {
      expect(sent).toEqual({host: 'mc.example.com', port: 25575})
    })
  })

  it('shows a test result', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ok: false, error: 'auth_failed'}))
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Test connection'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Wrong RCON password.')
  })

  it('explains an internal address', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        Response.json({statusCode: 400, message: 'rcon_host_private'}, {status: 400})
      )
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Save RCON'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('public address')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @shop/admin test -- features/catalog`
Expected: FAIL.

- [ ] **Step 3: Implement**

`schemas.ts`, add:

```ts
const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i, 'Use a hex color like #ff6b1a'))
export const ServerFormSchema = v.object({
  slug: SlugField,
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Enter a name'),
    v.maxLength(40, 'Use at most 40 characters')
  ),
  accent: Hex,
  onAccent: Hex,
  isActive: v.boolean()
})
export type ServerForm = v.InferOutput<typeof ServerFormSchema>

export const RconFormSchema = v.object({
  host: v.pipe(v.string(), v.trim(), v.maxLength(253)),
  port: v.pipe(
    v.string(),
    v.trim(),
    v.check(
      p => p === '' || (/^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 65535),
      'Use a port between 1 and 65535'
    )
  ),
  password: v.string(),
  clearPassword: v.boolean()
})
export type RconForm = v.InferOutput<typeof RconFormSchema>
```

`server-editor.tsx` (Client Component). Behaviour:

1. Loads `useGetCatalogServerQuery({id}, {skip: !id})`; `useForm<ServerForm>` with `ServerFormSchema`, defaults `{slug: '', name: '', accent: '#ff6b1a', onAccent: '#000000', isActive: false}`, reset once when the server loads (same `loadedId` pattern as the product editor).
2. Fields: "Name", "Slug" (`readOnly` when the loaded server `isActive`, with the hint "Disable the server to change its slug."), "Accent" and "Text color" (each an `Input type="text"` plus a native `<input type="color" aria-hidden tabIndex={-1}>` bound to the same value), "Enabled" (existing servers only; new ones are created disabled).
3. A preview chip `data-testid="tab-preview"` with `style={{background: accent, color: onAccent}}` showing the name, from `useWatch`.
4. Save: new → `createCatalogServer({body: {slug, name, accent, onAccent}})` → `router.replace(\`/catalog/servers/${id}\`)`; existing → `updateCatalogServer({id, body: {...values, version}})`. Errors via `apiErrorMessage`in`role="alert"`; success "Saved. Live on the site within a minute."
5. Delete (existing): confirm step, `deleteCatalogServer({id, version})` → `router.push('/catalog')`; `in_use` shows the counts message.
6. `<fieldset disabled={!canEdit}>`; no Save/Delete without `canEdit`.
7. Below, when `canRcon` and the server is loaded: `<RconPanel server={server.data} />` under `<h2>RCON</h2>`.

`rcon-panel.tsx` (Client Component). Behaviour:

1. `useForm<RconForm>` with `RconFormSchema`, defaults `{host: server.rcon?.host ?? '', port: server.rcon?.port ? String(server.rcon.port) : '', password: '', clearPassword: false}`.
2. Fields "Host", "Port", "New password" (`type="password"`, `autoComplete="new-password"`, placeholder "Leave empty to keep it"), "Remove the stored password" (`Checkbox`, only when `server.rconPasswordSet`). Under the password: "A password is set." or "No password set."
3. "Save RCON" → `updateCatalogServerRcon({id: server.id, body})` where `body = {host: host || null, port: port ? Number(port) : null, ...(password && {password}), ...(clearPassword && {clearPassword: true})}`; clear the password field after a successful save. Errors in `role="alert"` via `apiErrorMessage`.
4. "Test connection" → `testCatalogServerRcon({id: server.id})`. Show the result in `role="status"`: `ok` → `Connected in ${ms} ms.`; `timeout` → "No answer within 5 seconds. Check host, port and the server’s firewall."; `unreachable` → "Could not connect. Check host and port."; `auth_failed` → "Wrong RCON password."; `decrypt_failed` → "The stored password cannot be read (the key changed). Enter it again." A request error (400/429/503) goes to the `role="alert"` via `apiErrorMessage`.

Pages: `catalog/servers/new/page.tsx` (needs `catalog.write`, else `notFound()`; heading "New server"; `<ServerEditor canEdit canRcon={false} />`) and `catalog/servers/[id]/page.tsx` (heading "Server"; `canEdit` from `catalog.write`, `canRcon` from `server.rcon`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @shop/admin test && pnpm --filter @shop/admin typecheck && pnpm --filter @shop/admin lint && pnpm --filter @shop/admin build`
Expected: PASS; the build needs no API.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): server editor with tab preview and rcon settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: e2e, configuration and docs

**Files:**

- Modify: `e2e/tests/admin.spec.ts`
- Modify: `compose.e2e.yaml` (api: `RCON_ENCRYPTION_KEY` test value), `.env.example`
- Modify: `docs/runbooks/deploy.md`, `docs/guides/deploy-from-scratch.md`, `CLAUDE.md`, `README.md` (feature list, if it lists admin features)

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Write the failing e2e test**

In `e2e/tests/admin.spec.ts`, track the owner's last TOTP step so later tests never reuse a code (the API refuses replays):

```ts
let lastOwnerStep = 0

/** The owner's next accepted TOTP code: never a step already used, at most one step ahead. */
async function ownerCode(page: Page): Promise<string> {
  const step = Math.max(Math.floor(Date.now() / 30_000), lastOwnerStep + 1)
  while (step > Math.floor(Date.now() / 30_000) + 1) await page.waitForTimeout(1000)
  lastOwnerStep = step
  return generateSync({secret: ownerSecret, epoch: step * 30})
}
```

Set `lastOwnerStep = Math.floor(Date.now() / 30_000)` right after `setUpTotp` in the first test, and use `await ownerCode(owner)` in the second test instead of its inline `nextStep` code. Then append:

```ts
test('the owner adds a product, enables it, moves it up and the shop shows it there', async ({
  page
}) => {
  test.setTimeout(180_000)
  const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
  await page.goto(`${ADMIN}/login`)
  await signInWithCode(page, OWNER)
  await page.getByLabel('Code from the app').fill(await ownerCode(page))
  await page.getByRole('button', {name: 'Verify'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()

  await page.getByRole('link', {name: 'Catalog'}).click()
  await page.getByRole('link', {name: '+ Product in Ranks'}).click()
  await page.getByLabel('Slug').fill('probe-rank')
  await page.getByLabel('Mark').fill('PRB')
  await page.getByLabel('Price EUR').fill('3.49')
  await page.getByLabel('Price PLN').fill('14.99')
  await page.getByLabel('Name (EN)').fill('Probe Rank')
  await page.getByRole('tab', {name: 'PL'}).click()
  await page.getByLabel('Name (PL)').fill('Ranga Próbna')
  await page.getByLabel('Grant commands').fill('lp user {nick} parent add probe')
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page).toHaveURL(/\/catalog\/products\/\w+$/)
  await page.getByLabel('Enabled').check()
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()

  // Keyboard drag: the new product starts last; one step up puts it above Legend.
  await page.goto(`${ADMIN}/catalog`)
  const list = page.getByRole('list', {name: 'Products in Ranks'})
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Legend', 'Probe Rank'])
  await list.getByRole('button', {name: 'Move Probe Rank'}).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])
  await page.reload()
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])

  // The storefront caches the catalog for up to 60 s.
  const shop = await page.context().newPage()
  await expect
    .poll(
      async () => {
        await shop.goto(`${WEB}/`)
        return shop.getByRole('button', {name: /^(Elite|Probe Rank|Legend)$/}).allTextContents()
      },
      {timeout: 90_000, intervals: [5_000]}
    )
    .toEqual(['Elite', 'Probe Rank', 'Legend'])

  // Leave the shared stack as the other e2e tests expect it.
  await page.getByRole('link', {name: 'Probe Rank'}).click()
  await page.getByLabel('Enabled').uncheck()
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()
  await page.getByRole('button', {name: 'Delete'}).click()
  await page.getByRole('button', {name: 'Confirm delete'}).click()
  await expect(page).toHaveURL(/\/catalog$/)
})
```

If the card buttons' accessible text differs from the product name (check `catalog.spec.ts`: `getByRole('button', {name: 'VIP', exact: true})`), adjust the storefront locator; the assertion is the relative order of the three names.

- [ ] **Step 2: Run the e2e test to verify it fails**

Run (fresh stack, as `docs/runbooks/deploy.md` §10 describes): `docker compose -f compose.yaml -f compose.e2e.yaml down -v && docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm --filter e2e exec playwright test tests/admin.spec.ts`
Expected: before Tasks 1–14 are in the images it fails; with them it must PASS. (If the stack was already rebuilt with Tasks 1–14, this is the green run.)

- [ ] **Step 3: Configuration and docs**

`.env.example`, after the rate-limit block:

```
# apps/api — RCON passwords are stored AES-256-GCM encrypted with this key (32 bytes, base64):
# `openssl rand -base64 32`. Without it, RCON settings and tests answer 503; the shop keeps working.
# Changing it makes stored RCON passwords unreadable (enter them again).
RCON_ENCRYPTION_KEY=
# apps/api — `true` lets RCON point at localhost / private networks. Dev and tests only, never in
# production: it would let an admin probe the server's internal network.
RCON_ALLOW_PRIVATE_HOSTS=
# apps/api — RCON connection tests per session per minute (default 5).
RATE_LIMIT_RCON_TEST=
```

`compose.e2e.yaml`, api service environment: `RCON_ENCRYPTION_KEY: <a fixed base64 test key, generated once with openssl and marked "e2e only">`.

`docs/runbooks/deploy.md` §5 Environment, `shop-api`: add `RCON_ENCRYPTION_KEY` (`openssl rand -base64 32`, store it in your password manager: losing it means re-entering every RCON password). Mention that `RCON_ALLOW_PRIVATE_HOSTS` must stay unset in production. Under "Migrations (automatic)", note that `20261014100100_catalog_admin_permissions` gives the existing `ADMIN` role `catalog.write` and `server.rcon`.

`docs/guides/deploy-from-scratch.md`: in the `shop-api` environment step add `RCON_ENCRYPTION_KEY` with the same `openssl rand -base64 32` / PowerShell recipe used for `BETTER_AUTH_SECRET`; in troubleshooting add "RCON Save says 'RCON is not configured on the server' → set `RCON_ENCRYPTION_KEY` on shop-api and redeploy" and "RCON Save says 'public address' → use the game host's public IP or name; internal addresses are refused on purpose".

`CLAUDE.md`, Architecture rules, after the admin auth bullet:

```
- Catalog writes go through `/api/admin/catalog` (`catalog-admin` module, ADR-free: REST per entity, `version` for optimistic locking, full id lists for reorders). Every admin route must be documented in `apps/api/src/openapi/` with `operationId`, `tags`, `summary`, `description` and response descriptions; `admin-routes.spec.ts` fails otherwise. The admin's drag-and-drop lists use `SortableList` (`apps/admin/src/features/catalog/components/sortable-list.tsx`, dnd-kit).
```

- [ ] **Step 4: Run everything**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int` and the e2e command from Step 2.
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add e2e compose.e2e.yaml .env.example docs CLAUDE.md README.md
git commit -m "test(e2e): add, enable and reorder a product from the admin; docs for rcon key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then `graphify update .`.
