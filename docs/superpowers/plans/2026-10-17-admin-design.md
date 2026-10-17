# Admin visual design and order stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin one dark, dense visual system (tokens, shared components, rail shell), a dashboard with order statistics, and restyle every existing admin screen on it.

**Architecture:** Tokens and fonts live in `apps/admin/src/app/globals.css` and `layout.tsx`; admin-only shared components in `apps/admin/src/components/`; `packages/ui` primitives are restyled through the tokens (only the admin imports them). One new API endpoint `GET /api/admin/stats/orders` in the `orders` module feeds the dashboard through RTK Query codegen. Screens keep their behaviour, labels and accessible names; only markup and classes change.

**Tech Stack:** Next.js 16 (admin), Tailwind v4, Radix (dropdown-menu, dialog), lucide-react, NestJS 11 + Prisma 7, valibot contracts in `@shop/shared`, Jest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-admin-design-design.md`. Direction contract: `apps/admin/.impeccable/surfaces/apps-admin.md`.

## Global Constraints

- Visual world: dark base, Inter Tight, JetBrains Mono for ids, one sage-green accent; dense 13–14 px body; no decoration (spec §2.1–2.3).
- At most one accent-filled card per screen. Status colours never reuse the accent; status is never colour-only (dot + text label).
- Desktop first; at 390 px wide no horizontal page scroll on any admin screen.
- WCAG 2.2 AA: visible focus ring on every control (`focus-visible:ring-2 ring-[--color-accent]`), keyboard-operable menus and sheet.
- Behaviour, permissions and API contracts unchanged except the new stats endpoint. Keep every accessible name the e2e uses: links `Home`, `Orders`, `Catalog`, `Content`, `Team`, `Audit log`, `Account`; heading `/^Welcome/` on `/`; heading `Orders`; label `Search by nick, email or order number`; catalog link `+ Product in <Category>`, list `Products in <Category>` whose links are product names, buttons `Move <name>`; all editor field labels and button names.
- No chart library: charts are hand-written SVG.
- Do not bump ESLint (9) or TypeScript (6) majors. New dependencies allowed: `lucide-react` (same range as web, `^1.49.0`), `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog` — admin only.
- Money is `amountMinor: Int` + `currency`; never floats in data (formatting divides by 100 only for display).
- Every admin route is documented in `apps/api/src/openapi/` with `operationId`, `tags`, `summary`, `description`, response descriptions (`admin-routes.spec.ts`).
- Before every commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (plus `pnpm test:int` for API tasks). Conventional Commits. Commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query "<question>"` before grepping; run `graphify update .` after editing code.

## Review Focus

1. Stats on a day with no orders, or a range with only one currency: the chart still shows every day (zero bars), KPIs show `€0.00` / `0 zł`, conversion shows "—" not `NaN%`.
2. A SUPPORT user without `order.read` (custom role) landing on `/`: sees the greeting and links, never a 403 error box.
3. Long values in narrow rows: a 254-char email or 16-char nick in the orders table at 390 px must truncate inside the card, not push the page sideways.
4. Row menu opened with the keyboard (Enter/Space, arrows, Escape returns focus to the `⋯` button).
5. Server accent colours chosen by staff (very light or very dark) on catalog cards: text uses the server's `onAccent`, never the admin foreground.

Each item has a test in the owning task (Tasks 1, 7, 5, 5, 9).

---

### Task 1: Order stats contract and endpoint

**Files:**

- Modify: `packages/shared/src/orders.ts` (append)
- Create: `apps/api/src/orders/orders-stats.service.ts`
- Modify: `apps/api/src/orders/orders-admin.controller.ts`, `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/openapi/orders-paths.ts`, `apps/api/openapi.json` (regenerated)
- Modify: `apps/admin/src/lib/api/generated.ts` (regenerated)
- Test: `apps/api/test/orders-stats.int-spec.ts`

**Interfaces:**

- Produces: `OrderStatsQuerySchema`, `OrderStatsSchema`, types `OrderStats`, `OrderStatsQuery`, `STATS_RANGES` in `@shop/shared/orders`; route `GET /api/admin/stats/orders?range=7d|30d`, `operationId: getOrderStats`; admin hook `useGetOrderStatsQuery({range})`.

- [ ] **Step 1: Add the contract** (append to `packages/shared/src/orders.ts`)

```ts
export const STATS_RANGES = ['7d', '30d'] as const
export const OrderStatsQuerySchema = v.object({
  range: v.optional(v.picklist(STATS_RANGES), '7d')
})
export type OrderStatsQuery = v.InferOutput<typeof OrderStatsQuerySchema>

const Count = v.pipe(v.number(), v.integer(), v.minValue(0))
export const OrderStatsSchema = v.object({
  range: v.picklist(STATS_RANGES),
  from: Iso,
  to: Iso,
  revenue: v.array(v.object({currency: CurrencySchema, totalMinor: Minor, previousMinor: Minor})),
  paidCount: Count,
  previousPaidCount: Count,
  expiredCount: Count,
  conversion: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  byStatus: v.array(v.object({status: OrderStatusSchema, count: Count})),
  daily: v.array(
    v.object({
      day: v.pipe(v.string(), v.isoDate()),
      currency: CurrencySchema,
      totalMinor: Minor,
      paidCount: Count
    })
  ),
  topProducts: v.array(
    v.object({productId: v.string(), name: v.string(), serverName: v.string(), quantity: Count})
  )
})
export type OrderStats = v.InferOutput<typeof OrderStatsSchema>
```

Build shared: `pnpm --filter @shop/shared build`.

- [ ] **Step 2: Write the failing int-spec** `apps/api/test/orders-stats.int-spec.ts`

Use `startOrdersApp` like `orders-admin.int-spec.ts`. The service's `stats(query, now = new Date())` takes `now` as a parameter; the spec computes expectations relative to `new Date()` by creating orders at `now - k days` (UTC day boundaries computed in the spec).

```ts
import {startOrdersApp} from './support/orders-app'

jest.setTimeout(180_000)

let ctx: Awaited<ReturnType<typeof startOrdersApp>>
let n = 0
const DAY = 86_400_000
const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

type Stats = {
  range: string
  from: string
  revenue: {currency: string; totalMinor: number; previousMinor: number}[]
  paidCount: number
  previousPaidCount: number
  expiredCount: number
  conversion: number | null
  byStatus: {status: string; count: number}[]
  daily: {day: string; currency: string; totalMinor: number; paidCount: number}[]
  topProducts: {name: string; serverName: string; quantity: number}[]
}

async function order(opts: {
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED'
  currency?: 'EUR' | 'PLN'
  totalMinor?: number
  at: Date
  items?: {
    productId: string
    serverId: string
    name: string
    serverName: string
    quantity: number
  }[]
}) {
  n += 1
  const paid = ['PAID', 'DELIVERED', 'REFUNDED'].includes(opts.status)
  return ctx.prisma.order.create({
    data: {
      publicId: `sta${String(n).padStart(19, '0')}`,
      nick: 'Steve',
      email: 's@example.com',
      locale: 'en',
      currency: opts.currency ?? 'EUR',
      subtotalMinor: opts.totalMinor ?? 1000,
      totalMinor: opts.totalMinor ?? 1000,
      status: opts.status,
      deliveryConsentAt: opts.at,
      createdAt: opts.at,
      paidAt: paid ? opts.at : null,
      items: opts.items
        ? {
            create: opts.items.map(i => ({
              productId: i.productId,
              serverId: i.serverId,
              productName: i.name,
              serverName: i.serverName,
              quantity: i.quantity,
              unitAmountMinor: 100
            }))
          }
        : undefined
    }
  })
}

beforeAll(async () => {
  ctx = await startOrdersApp()
})
afterAll(async () => {
  await ctx.stop()
})
beforeEach(async () => {
  await ctx.prisma.orderItem.deleteMany()
  await ctx.prisma.order.deleteMany()
})

const get = async (query = '') =>
  (await (await ctx.admin('SUPPORT')).get(`/api/admin/stats/orders${query}`).expect(200))
    .body as Stats

describe('order stats', () => {
  it('returns zeros, null conversion and every day of the range on an empty database', async () => {
    const s = await get()
    expect(s.range).toBe('7d')
    expect(s.paidCount).toBe(0)
    expect(s.conversion).toBeNull()
    expect(s.revenue).toEqual([
      {currency: 'EUR', totalMinor: 0, previousMinor: 0},
      {currency: 'PLN', totalMinor: 0, previousMinor: 0}
    ])
    expect(new Set(s.daily.map(d => d.day)).size).toBe(7)
    expect(s.daily).toHaveLength(14) // 7 days × 2 currencies
    expect(s.daily.every(d => d.totalMinor === 0 && d.paidCount === 0)).toBe(true)
    expect(s.daily.at(-1)?.day).toBe(new Date().toISOString().slice(0, 10))
  })

  it('counts revenue per currency from PAID and DELIVERED only, with the previous period', async () => {
    const now = new Date()
    await order({status: 'PAID', totalMinor: 500, at: now})
    await order({status: 'DELIVERED', totalMinor: 700, at: new Date(now.getTime() - 2 * DAY)})
    await order({status: 'PAID', currency: 'PLN', totalMinor: 2000, at: now})
    await order({status: 'REFUNDED', totalMinor: 9999, at: now})
    await order({status: 'PENDING', totalMinor: 9999, at: now})
    await order({status: 'PAID', totalMinor: 300, at: new Date(now.getTime() - 9 * DAY)}) // previous 7d
    const s = await get('?range=7d')
    expect(s.revenue).toEqual([
      {currency: 'EUR', totalMinor: 1200, previousMinor: 300},
      {currency: 'PLN', totalMinor: 2000, previousMinor: 0}
    ])
    expect(s.paidCount).toBe(3)
    expect(s.previousPaidCount).toBe(1)
    const today = now.toISOString().slice(0, 10)
    expect(s.daily.find(d => d.day === today && d.currency === 'EUR')).toEqual({
      day: today,
      currency: 'EUR',
      totalMinor: 500,
      paidCount: 1
    })
  })

  it('computes conversion as paid / (paid + expired) and counts every status', async () => {
    const now = new Date()
    await order({status: 'PAID', at: now})
    await order({status: 'EXPIRED', at: now})
    await order({status: 'EXPIRED', at: now})
    await order({status: 'PENDING', at: now})
    const s = await get()
    expect(s.expiredCount).toBe(2)
    expect(s.conversion).toBeCloseTo(1 / 3)
    expect(s.byStatus).toEqual(
      expect.arrayContaining([
        {status: 'PAID', count: 1},
        {status: 'EXPIRED', count: 2},
        {status: 'PENDING', count: 1}
      ])
    )
  })

  it('starts the range at a UTC midnight and excludes the day before it', async () => {
    const from = new Date(startOfUtcDay(new Date()).getTime() - 6 * DAY)
    await order({status: 'PAID', totalMinor: 100, at: from})
    await order({status: 'PAID', totalMinor: 100, at: new Date(from.getTime() - 1)})
    const s = await get()
    expect(s.from).toBe(from.toISOString())
    expect(s.revenue[0]?.totalMinor).toBe(100)
  })

  it('ranks the top five products by quantity over paid orders', async () => {
    const server = await ctx.prisma.server.findFirstOrThrow()
    const products = await ctx.prisma.product.findMany({where: {serverId: server.id}, take: 6})
    const now = new Date()
    for (const [i, p] of products.entries())
      await order({
        status: 'PAID',
        at: now,
        items: [
          {
            productId: p.id,
            serverId: server.id,
            name: `P${String(i)}`,
            serverName: server.name,
            quantity: i + 1
          }
        ]
      })
    await order({
      status: 'PENDING',
      at: now,
      items: [
        {
          productId: products[0]!.id,
          serverId: server.id,
          name: 'P0',
          serverName: server.name,
          quantity: 50
        }
      ]
    })
    const s = await get()
    expect(s.topProducts.map(p => p.quantity)).toEqual(
      [6, 5, 4, 3, 2].slice(0, Math.min(5, products.length))
    )
    expect(s.topProducts[0]?.serverName).toBe(server.name)
  })

  it('accepts 30d, rejects other ranges and needs order.read', async () => {
    expect((await get('?range=30d')).daily).toHaveLength(60)
    const admin = await ctx.admin('SUPPORT')
    await admin.get('/api/admin/stats/orders?range=1y').expect(400)
    const custom = await ctx.admin({permissions: ['audit.read']})
    await custom.get('/api/admin/stats/orders').expect(403)
  })
})
```

If the seeded catalog has fewer than six products for the first server, the expectation slice keeps the test valid; if the `orderItem` model's field names differ from those above, read `apps/api/prisma/schema.prisma` (`model OrderItem`) and match them.

- [ ] **Step 3: Run it, watch it fail**

Run: `pnpm --filter @shop/api test:int -- orders-stats`
Expected: FAIL with 404 on `/api/admin/stats/orders`.

- [ ] **Step 4: Implement** `apps/api/src/orders/orders-stats.service.ts`

```ts
import {Injectable} from '@nestjs/common'

import type {OrderStats, OrderStatsQuery} from '@shop/shared/orders'

import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'

const CURRENCIES = ['EUR', 'PLN'] as const
const DAY = 86_400_000
const REVENUE_STATUSES = ['PAID', 'DELIVERED'] as const

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

@Injectable()
export class OrdersStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(query: OrderStatsQuery, now = new Date()): Promise<OrderStats> {
    const days = query.range === '30d' ? 30 : 7
    const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY)
    const prevFrom = new Date(from.getTime() - days * DAY)
    const revenueWhere = (gte: Date, lt: Date): Prisma.OrderWhereInput => ({
      status: {in: [...REVENUE_STATUSES]},
      paidAt: {gte, lt}
    })

    const [current, previous, byStatus, daily, top] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['currency'],
        where: revenueWhere(from, now),
        _sum: {totalMinor: true},
        _count: {_all: true}
      }),
      this.prisma.order.groupBy({
        by: ['currency'],
        where: revenueWhere(prevFrom, from),
        _sum: {totalMinor: true},
        _count: {_all: true}
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: {createdAt: {gte: from, lte: now}},
        _count: {_all: true}
      }),
      this.prisma.$queryRaw<
        {day: Date; currency: string; total: bigint; count: bigint}[]
      >(Prisma.sql`
        SELECT date_trunc('day', "paidAt" AT TIME ZONE 'UTC') AS day, currency::text AS currency,
               SUM("totalMinor")::bigint AS total, COUNT(*)::bigint AS count
        FROM orders
        WHERE status IN ('PAID', 'DELIVERED') AND "paidAt" >= ${from} AND "paidAt" < ${now}
        GROUP BY 1, 2`),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName', 'serverName'],
        where: {order: revenueWhere(from, now)},
        _sum: {quantity: true},
        orderBy: {_sum: {quantity: 'desc'}},
        take: 5
      })
    ])

    const sum = (rows: typeof current, c: string) =>
      rows.find(r => r.currency === c)?._sum.totalMinor ?? 0
    const count = (rows: typeof current) => rows.reduce((a, r) => a + r._count._all, 0)
    const statusCount = (s: string) => byStatus.find(r => r.status === s)?._count._all ?? 0
    const paidCount = count(current)
    const expiredCount = statusCount('EXPIRED')
    const paidInRange = statusCount('PAID') + statusCount('DELIVERED')

    const dailyRows: OrderStats['daily'] = []
    for (let i = 0; i < days; i++) {
      const day = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10)
      for (const currency of CURRENCIES) {
        const row = daily.find(
          r => r.day.toISOString().slice(0, 10) === day && r.currency === currency
        )
        dailyRows.push({
          day,
          currency,
          totalMinor: Number(row?.total ?? 0),
          paidCount: Number(row?.count ?? 0)
        })
      }
    }

    return {
      range: query.range,
      from: from.toISOString(),
      to: now.toISOString(),
      revenue: CURRENCIES.map(currency => ({
        currency,
        totalMinor: sum(current, currency),
        previousMinor: sum(previous, currency)
      })),
      paidCount,
      previousPaidCount: count(previous),
      expiredCount,
      conversion:
        paidInRange + expiredCount === 0 ? null : paidInRange / (paidInRange + expiredCount),
      byStatus: byStatus.map(r => ({status: r.status, count: r._count._all})),
      daily: dailyRows,
      topProducts: top.map(t => ({
        productId: t.productId,
        name: t.productName,
        serverName: t.serverName,
        quantity: t._sum.quantity ?? 0
      }))
    }
  }
}
```

Note: `paidCount` counts orders paid in the range (revenue basis); `conversion` uses orders _created_ in the range (PAID + DELIVERED vs EXPIRED), so a still-PENDING order counts in neither. Ledger this if the int-spec's conversion case needs adjusting.

Controller (`orders-admin.controller.ts`): the admin controller's path is `orders`, but the route is `/api/admin/stats/orders`; add a second controller in the same file:

```ts
@AdminController('stats')
export class OrderStatsController {
  constructor(private readonly stats: OrdersStatsService) {}

  @Get('orders')
  @RequirePermission('order.read')
  orders(@Query(new ValibotPipe(OrderStatsQuerySchema)) q: OrderStatsQuery): Promise<OrderStats> {
    return this.stats.stats(q)
  }
}
```

Register `OrderStatsController` and `OrdersStatsService` in `orders.module.ts`.

OpenAPI (`orders-paths.ts`):

```ts
  '/api/admin/stats/orders': {
    get: adminOp({
      operationId: 'getOrderStats',
      summary: 'Order and revenue statistics for the dashboard',
      description:
        'Needs `order.read`. `range` is `7d` (default) or `30d`, ending now; days are UTC. Revenue counts PAID and DELIVERED orders by payment time; `previous*` cover the same-length range before. `conversion` is paid ÷ (paid + expired) over orders created in the range, `null` when there are none.',
      parameters: [queryParam('range', OrderStatsQuerySchema.entries.range.wrapped)],
      responses: {
        '200': json('Statistics for the range', OrderStatsSchema),
        '400': {description: 'Unknown range'},
        ...guarded
      }
    })
  }
```

- [ ] **Step 5: Run the int-spec and the route-doc spec**

Run: `pnpm --filter @shop/api test:int -- orders-stats && pnpm --filter @shop/api test -- admin-routes`
Expected: PASS.

- [ ] **Step 6: Regenerate OpenAPI and admin client**

Run: `pnpm --filter @shop/api openapi && pnpm --filter @shop/admin codegen`
Expected: `generated.ts` exports `useGetOrderStatsQuery`.

- [ ] **Step 7: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add packages/shared/src/orders.ts apps/api apps/admin/src/lib/api/generated.ts
git commit -m "feat(api): order stats endpoint for the admin dashboard"
```

---

### Task 2: Tokens, fonts and restyled primitives

**Files:**

- Modify: `apps/admin/src/app/globals.css`, `apps/admin/src/app/layout.tsx`
- Delete: `packages/ui/src/theme.css` (and its `exports` entry in `packages/ui/package.json` if present)
- Modify: `packages/ui/src/{button,input,select,textarea,checkbox,table,tabs,label}.tsx`
- Modify: `apps/admin/package.json` (add `lucide-react`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`)
- Test: `apps/admin/src/app/layout.test.ts` (extend), `packages/ui` has no tests — add `apps/admin/src/test/primitives.test.tsx`

**Interfaces:**

- Produces Tailwind colour utilities used by every later task: `bg-bg`, `bg-surface`, `bg-card`, `bg-card-raised`, `border-line`, `border-border`, `text-fg`, `text-muted`, `bg-accent`, `text-on-accent`, `bg-accent-soft`, `text-ok`/`bg-ok-soft`, `text-warn`/`bg-warn-soft`, `text-bad`/`bg-bad-soft`, `text-idle`/`bg-idle-soft`; radii `rounded-card` (20 px), `rounded-plate` (14 px); fonts `font-sans`, `font-mono`. Legacy shadcn names (`primary`, `background`, `foreground`, `input`, `muted-foreground`, `destructive`) stay mapped so untouched screens keep working until restyled.
- `Button` variants: `default` (accent fill), `outline`, `ghost`, `danger`; sizes `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (size-9).

- [ ] **Step 1: Failing test** `apps/admin/src/test/primitives.test.tsx`

```tsx
import {render, screen} from '@testing-library/react'

import {Button} from '@shop/ui/button'

describe('primitives', () => {
  it('Button has accent, ghost, danger and icon styles and a focus ring', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button size="icon" aria-label="More">
          ⋯
        </Button>
      </>
    )
    expect(screen.getByRole('button', {name: 'Save'}).className).toMatch(/bg-accent/)
    expect(screen.getByRole('button', {name: 'Cancel'}).className).toMatch(/hover:bg-card-raised/)
    expect(screen.getByRole('button', {name: 'Delete'}).className).toMatch(/text-bad/)
    expect(screen.getByRole('button', {name: 'More'}).className).toMatch(/size-9/)
    expect(screen.getByRole('button', {name: 'Save'}).className).toMatch(/focus-visible:ring-2/)
  })
})
```

Extend `layout.test.ts` with an assertion that `RootLayout` puts the Inter Tight and JetBrains Mono font variables on `<html>` (follow the file's current pattern of rendering the layout; mock `next/font/google` with `jest.mock('next/font/google', () => ({Inter_Tight: () => ({variable: 'font-inter-tight'}), JetBrains_Mono: () => ({variable: 'font-jetbrains-mono'})}))`).

- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- primitives layout` → FAIL (no `bg-accent` / variant).

- [ ] **Step 3: Implement**

`globals.css`:

```css
@import 'tailwindcss';

@source '../../../../packages/ui/src';

@theme {
  --font-sans: var(--font-inter-tight), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

  --color-bg: #0e0e10;
  --color-surface: #17171a;
  --color-card: #1d1d20;
  --color-card-raised: #26262a;
  --color-line: rgb(255 255 255 / 0.07);
  --color-border: rgb(255 255 255 / 0.12);
  --color-fg: #f2f2f2;
  --color-muted: #8e8e93;

  --color-accent: #9cc5a1;
  --color-on-accent: #0e1a10;
  --color-accent-soft: color-mix(in oklab, #9cc5a1 16%, transparent);

  --color-ok: #3ddc84;
  --color-ok-soft: color-mix(in oklab, #3ddc84 14%, transparent);
  --color-warn: #ffc857;
  --color-warn-soft: color-mix(in oklab, #ffc857 14%, transparent);
  --color-bad: #ff8a80;
  --color-bad-soft: color-mix(in oklab, #ff8a80 14%, transparent);
  --color-idle: #8e8e93;
  --color-idle-soft: rgb(255 255 255 / 0.06);

  /* legacy names used by screens not yet restyled */
  --color-primary: var(--color-accent);
  --color-primary-foreground: var(--color-on-accent);
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  --color-input: var(--color-border);
  --color-muted-foreground: var(--color-muted);
  --color-destructive: var(--color-bad);

  --radius-card: 20px;
  --radius-plate: 14px;
}

body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.label-caps {
  @apply text-muted text-[11px] font-semibold tracking-[0.12em] uppercase;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Note: `--color-accent` was previously `bg-accent` = a dark hover grey in legacy screens (`hover:bg-accent`). Replace every `hover:bg-accent` / `aria-[current=page]:bg-accent` in `apps/admin/src` with `hover:bg-card-raised` / `aria-[current=page]:bg-card-raised` in this task (13 occurrences; `grep -rn "bg-accent" apps/admin/src`), so the sage accent appears only where intended.

`layout.tsx`: load `Inter_Tight` (400/500/700) and `JetBrains_Mono` (500) with `subsets: ['latin', 'latin-ext']`, `display: 'swap'`, `variable` `--font-inter-tight` / `--font-jetbrains-mono`; put both `.variable` classes on `<html className=...>`; `<body className="min-h-screen bg-bg text-fg">`.

`button.tsx` base and variants:

```ts
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-on-accent hover:bg-accent/90',
        outline: 'border border-border bg-transparent text-fg hover:bg-card-raised',
        ghost: 'bg-transparent text-muted hover:bg-card-raised hover:text-fg',
        danger: 'border border-bad/40 bg-bad-soft text-bad hover:bg-bad/20'
      },
      size: {default: 'h-9 px-4', sm: 'h-8 px-3 text-[13px]', lg: 'h-10 px-6', icon: 'size-9'}
    },
    defaultVariants: {variant: 'default', size: 'default'}
  }
)
```

`input`, `select`, `textarea`: `rounded-plate border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-invalid:border-bad` (input/select `h-9`, textarea `min-h-24 py-2`). `checkbox`: `size-4 rounded-[5px] border border-border bg-surface data-[state=checked]:bg-accent data-[state=checked]:text-on-accent`. `label`: `text-[13px] font-medium text-fg`. `tabs`: list `inline-flex gap-1 rounded-full bg-surface p-1`; trigger `rounded-full px-3 h-8 text-[13px] text-muted data-[state=active]:bg-card-raised data-[state=active]:text-fg`. `table`: header cells `label-caps h-10 px-3`, rows `border-b border-line`, cells `px-3 py-2.5 text-[13px]`.

Delete `packages/ui/src/theme.css` and remove its import (it was only imported by admin `globals.css`); remove a `./theme.css` export from `packages/ui/package.json` if listed.

Install: `pnpm --filter @shop/admin add lucide-react@^1.49.0 @radix-ui/react-dropdown-menu @radix-ui/react-dialog`.

- [ ] **Step 4: Run** `pnpm --filter @shop/admin test` → all PASS (existing tests included).

- [ ] **Step 5: Gate and commit** — `feat(admin): dark tokens, fonts and restyled primitives`.

---

### Task 3: Layout components — Card, PageHeader, EmptyState, Skeleton, FormSection

**Files:**

- Create: `apps/admin/src/components/{card,page-header,empty-state,skeleton,form-section}.tsx`
- Test: `apps/admin/src/components/layout-components.test.tsx`

**Interfaces:**

- Produces:
  - `Card({title?, action?, tone?: 'default' | 'accent', className?, children})` — `<section>` with `aria-labelledby` when `title` is set; `tone="accent"` → `bg-accent text-on-accent`.
  - `PageHeader({title, description?, actions?})` — `<header>` with `<h1>`.
  - `EmptyState({icon: LucideIcon, title, action?})`.
  - `Skeleton({className})` — `aria-hidden` shimmer block; `SkeletonRows({rows = 5})`.
  - `FormSection({title, description?, children})` — card with a two-column grid (`md:grid-cols-2`) of fields.

- [ ] **Step 1: Failing test**

```tsx
import {render, screen} from '@testing-library/react'
import {Inbox} from 'lucide-react'

import {Card} from './card'
import {EmptyState} from './empty-state'
import {FormSection} from './form-section'
import {PageHeader} from './page-header'
import {SkeletonRows} from './skeleton'

describe('layout components', () => {
  it('Card is a named region with an optional action', () => {
    render(
      <Card title="Revenue" action={<button>7d</button>}>
        body
      </Card>
    )
    expect(screen.getByRole('region', {name: 'Revenue'})).toHaveTextContent('body')
    expect(screen.getByRole('button', {name: '7d'})).toBeInTheDocument()
  })

  it('accent Card uses the accent fill', () => {
    render(
      <Card title="Paid" tone="accent">
        1
      </Card>
    )
    expect(screen.getByRole('region', {name: 'Paid'}).className).toMatch(/bg-accent/)
  })

  it('PageHeader renders one h1 and its description', () => {
    render(<PageHeader title="Orders" description="All orders, newest first." />)
    expect(screen.getByRole('heading', {level: 1, name: 'Orders'})).toBeInTheDocument()
    expect(screen.getByText('All orders, newest first.')).toBeInTheDocument()
  })

  it('EmptyState shows its sentence and action', () => {
    render(<EmptyState icon={Inbox} title="No orders yet." action={<a href="/x">Open shop</a>} />)
    expect(screen.getByText('No orders yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Open shop'})).toBeInTheDocument()
  })

  it('SkeletonRows is hidden from assistive tech and announces loading once', () => {
    render(<SkeletonRows rows={3} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('FormSection groups fields under a heading', () => {
    render(
      <FormSection title="Prices">
        <label>
          EUR <input />
        </label>
      </FormSection>
    )
    expect(screen.getByRole('group', {name: 'Prices'})).toContainElement(
      screen.getByLabelText('EUR')
    )
  })
})
```

- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- layout-components` → FAIL (modules missing).

- [ ] **Step 3: Implement**

```tsx
// card.tsx
import {type ReactNode, useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

export function Card({
  title,
  action,
  tone = 'default',
  className,
  children
}: {
  title?: string
  action?: ReactNode
  tone?: 'default' | 'accent'
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn(
        'rounded-card flex min-w-0 flex-col gap-4 p-5',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card',
        className
      )}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h2 id={id} className="text-[15px] font-semibold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
```

```tsx
// page-header.tsx
import type {ReactNode} from 'react'

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
```

```tsx
// empty-state.tsx
import type {LucideIcon} from 'lucide-react'
import type {ReactNode} from 'react'

export function EmptyState({
  icon: Icon,
  title,
  action
}: {
  icon: LucideIcon
  title: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-card border-border flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center">
      <span className="bg-card-raised text-muted grid size-11 place-items-center rounded-full">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="text-muted">{title}</p>
      {action}
    </div>
  )
}
```

```tsx
// skeleton.tsx
import {cn} from '@shop/ui/lib/utils'

export function Skeleton({className}: {className?: string}) {
  return <div aria-hidden className={cn('rounded-plate bg-card-raised animate-pulse', className)} />
}

export function SkeletonRows({rows = 5}: {rows?: number}) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Loading…</span>
      {Array.from({length: rows}, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}
```

```tsx
// form-section.tsx
import type {ReactNode} from 'react'

export function FormSection({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="rounded-card bg-card flex min-w-0 flex-col gap-4 p-5">
      <legend className="float-left mb-1 w-full">
        <span className="block text-[15px] font-semibold">{title}</span>
        {description && <span className="text-muted mt-1 block text-[13px]">{description}</span>}
      </legend>
      <div className="clear-both grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}
```

(A `<fieldset>` with `<legend>` has role `group` named by the legend.)

- [ ] **Step 4: Run** → PASS. **Step 5:** gate, commit `feat(admin): card, page header, empty state, skeleton and form section`.

---

### Task 4: Status, KPI and chart components

**Files:**

- Create: `apps/admin/src/components/{status-dot,kpi-card,spark,day-chart,ring}.tsx`, `apps/admin/src/lib/format.ts` (move `formatMoney`, `formatTime` from `features/orders/lib/format.ts`, keep `stripeSessionUrl` there and re-export nothing — update imports)
- Delete: `apps/admin/src/features/orders/components/order-status-badge.tsx` (replace its uses with `StatusDot`)
- Test: `apps/admin/src/components/data-components.test.tsx`

**Interfaces:**

- Produces:
  - `STATUS_TONE: Record<OrderStatus, 'ok' | 'warn' | 'bad' | 'idle'>` — PAID ok, DELIVERED ok, PENDING warn, EXPIRED idle, REFUNDED bad, DISPUTED bad; `STATUS_LABEL: Record<OrderStatus, string>` — Paid, Delivered, Pending, Expired, Refunded, Disputed.
  - `StatusDot({status})` — dot + label pill. Later 5a extends the maps for delivery statuses.
  - `KpiCard({label, value, delta?: number | null, hint?, tone?, spark?: number[]})` — `delta` is a fraction (0.12 = +12 %), `null` hides it.
  - `Spark({values, label})`, `DayChart({days: {day: string; value: number}[], label, format: (n: number) => string})`, `Ring({value: number | null, label})` — all `role="img"` with `aria-label`.
  - `formatMoney(minor, currency)`, `formatTime(iso)`, `formatPercent(fraction | null)` → `'—'` for null, `formatDelta(fraction)` → `'+12%'` / `'−8%'` / `'0%'`.

- [ ] **Step 1: Failing test**

```tsx
import {render, screen} from '@testing-library/react'

import {ORDER_STATUSES} from '@shop/shared/orders'

import {formatDelta, formatMoney, formatPercent} from '../lib/format'
import {DayChart} from './day-chart'
import {KpiCard} from './kpi-card'
import {Ring} from './ring'
import {Spark} from './spark'
import {STATUS_TONE, StatusDot} from './status-dot'

describe('data components', () => {
  it('StatusDot labels every order status in words and maps a tone', () => {
    for (const s of ORDER_STATUSES) {
      const {unmount} = render(<StatusDot status={s} />)
      expect(
        screen.getByText(/^(Paid|Delivered|Pending|Expired|Refunded|Disputed)$/)
      ).toBeInTheDocument()
      expect(['ok', 'warn', 'bad', 'idle']).toContain(STATUS_TONE[s])
      unmount()
    }
    expect(STATUS_TONE.DISPUTED).toBe('bad')
    expect(STATUS_TONE.PENDING).toBe('warn')
  })

  it('KpiCard shows value and signed delta, hides a null delta', () => {
    const {rerender} = render(<KpiCard label="Paid orders" value="12" delta={0.25} />)
    expect(screen.getByRole('region', {name: 'Paid orders'})).toHaveTextContent('12')
    expect(screen.getByText('+25%')).toBeInTheDocument()
    rerender(<KpiCard label="Paid orders" value="12" delta={-0.1} />)
    expect(screen.getByText('−10%')).toBeInTheDocument()
    rerender(<KpiCard label="Paid orders" value="12" delta={null} />)
    expect(screen.queryByText(/%$/)).toBeNull()
  })

  it('formats money, empty percent and zero delta', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00')
    expect(formatMoney(1999, 'PLN')).toMatch(/19\.99/)
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(1 / 3)).toBe('33%')
    expect(formatDelta(0)).toBe('0%')
  })

  it('charts expose a text alternative and survive all-zero data', () => {
    render(
      <>
        <Spark values={[0, 0, 0]} label="Paid per day" />
        <DayChart
          label="Revenue per day"
          format={n => formatMoney(n, 'EUR')}
          days={[
            {day: '2026-10-16', value: 0},
            {day: '2026-10-17', value: 1200}
          ]}
        />
        <Ring value={null} label="Conversion" />
      </>
    )
    expect(screen.getByRole('img', {name: 'Paid per day: 0 → 0'})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Revenue per day.*€12\.00/})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: 'Conversion: —'})).toBeInTheDocument()
    expect(document.querySelector('svg [d*="NaN"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/format.ts
export const formatTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
export const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat('en', {style: 'currency', currency}).format(amountMinor / 100)
export const formatPercent = (fraction: number | null) =>
  fraction === null ? '—' : `${String(Math.round(fraction * 100))}%`
export const formatDelta = (fraction: number) => {
  const pct = Math.round(fraction * 100)
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : '−'}${String(Math.abs(pct))}%`
}
/** Change from previous to current as a fraction; null when there is no base to compare with. */
export const delta = (current: number, previous: number) =>
  previous === 0 ? null : (current - previous) / previous
```

```tsx
// status-dot.tsx
import type {OrderStatus} from '@shop/shared/orders'
import {cn} from '@shop/ui/lib/utils'

export type Tone = 'ok' | 'warn' | 'bad' | 'idle'
export const STATUS_TONE: Record<OrderStatus, Tone> = {
  PAID: 'ok',
  DELIVERED: 'ok',
  PENDING: 'warn',
  EXPIRED: 'idle',
  REFUNDED: 'bad',
  DISPUTED: 'bad'
}
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PAID: 'Paid',
  DELIVERED: 'Delivered',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed'
}
const PILL: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  idle: 'bg-idle-soft text-muted'
}
const DOT: Record<Tone, string> = {ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-idle'}

export function ToneDot({tone, label}: {tone: Tone; label: string}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium',
        PILL[tone]
      )}>
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      {label}
    </span>
  )
}

export function StatusDot({status}: {status: OrderStatus}) {
  return <ToneDot tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
}
```

```tsx
// spark.tsx
export function Spark({
  values,
  label,
  className
}: {
  values: number[]
  label: string
  className?: string
}) {
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? 100 / (values.length - 1) : 100
  const points = values
    .map((v, i) => `${String(i * step)},${String(30 - (v / max) * 26 - 2)}`)
    .join(' ')
  return (
    <svg
      role="img"
      aria-label={`${label}: ${String(values[0] ?? 0)} → ${String(values.at(-1) ?? 0)}`}
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={className ?? 'h-8 w-24'}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

```tsx
// day-chart.tsx
export function DayChart({
  days,
  label,
  format
}: {
  days: {day: string; value: number}[]
  label: string
  format: (n: number) => string
}) {
  const max = Math.max(1, ...days.map(d => d.value))
  const total = days.reduce((a, d) => a + d.value, 0)
  const w = 100 / Math.max(1, days.length)
  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`${label}: total ${format(total)} over ${String(days.length)} days`}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="text-accent h-40 w-full">
        {days.map((d, i) => {
          const h = (d.value / max) * 36
          return (
            <rect
              key={d.day}
              x={i * w + w * 0.15}
              y={40 - Math.max(h, 0.6)}
              width={w * 0.7}
              height={Math.max(h, 0.6)}
              rx="0.8"
              className={d.value === 0 ? 'fill-card-raised' : 'fill-current'}>
              <title>{`${d.day}: ${format(d.value)}`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="text-muted tabular flex justify-between text-[11px]">
        <span>{days[0]?.day.slice(5)}</span>
        <span>{days.at(-1)?.day.slice(5)}</span>
      </figcaption>
    </figure>
  )
}
```

```tsx
// ring.tsx
import {formatPercent} from '@/lib/format'

export function Ring({value, label}: {value: number | null; label: string}) {
  const r = 16
  const c = 2 * Math.PI * r
  const filled = value === null ? 0 : Math.min(1, Math.max(0, value)) * c
  return (
    <svg
      role="img"
      aria-label={`${label}: ${formatPercent(value)}`}
      viewBox="0 0 40 40"
      className="size-24">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-card-raised" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${String(filled)} ${String(c)}`}
        transform="rotate(-90 20 20)"
        className="stroke-accent"
      />
      <text x="20" y="22.5" textAnchor="middle" className="fill-fg text-[8px] font-semibold">
        {formatPercent(value)}
      </text>
    </svg>
  )
}
```

```tsx
// kpi-card.tsx
import {formatDelta} from '@/lib/format'
import {useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {Spark} from './spark'

export function KpiCard({
  label,
  value,
  delta,
  hint,
  tone = 'default',
  spark
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  tone?: 'default' | 'accent'
  spark?: number[]
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'rounded-card flex min-w-0 flex-col gap-3 p-5',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-card'
      )}>
      <h2 id={id} className={cn('label-caps', tone === 'accent' && 'text-on-accent/70')}>
        {label}
      </h2>
      <div className="flex items-end justify-between gap-3">
        <p className="tabular truncate text-[32px] leading-none font-semibold tracking-[-0.02em]">
          {value}
        </p>
        {spark && (
          <Spark
            values={spark}
            label={`${label} per day`}
            className={cn(
              'h-8 w-24 shrink-0',
              tone === 'accent' ? 'text-on-accent' : 'text-accent'
            )}
          />
        )}
      </div>
      {(delta !== undefined && delta !== null) || hint ? (
        <p className={cn('text-[12px]', tone === 'accent' ? 'text-on-accent/70' : 'text-muted')}>
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                'font-semibold',
                tone !== 'accent' && (delta >= 0 ? 'text-ok' : 'text-bad')
              )}>
              {formatDelta(delta)}
            </span>
          )}{' '}
          {hint}
        </p>
      ) : null}
    </section>
  )
}
```

Replace `OrderStatusBadge` imports (`orders-table.tsx`, `order-details.tsx`) with `StatusDot`; update `features/orders` imports of `formatMoney`/`formatTime` to `@/lib/format`; keep `stripeSessionUrl` in `features/orders/lib/format.ts`. Existing orders tests asserting `'PAID'` text change to `'Paid'`.

- [ ] **Step 4: Run** `pnpm --filter @shop/admin test` → PASS. **Step 5:** gate, commit `feat(admin): status dot, KPI card and SVG charts`.

---

### Task 5: RowMenu and DataTable

**Files:**

- Create: `apps/admin/src/components/row-menu.tsx`, `apps/admin/src/components/data-table.tsx`
- Test: `apps/admin/src/components/data-table.test.tsx`

**Interfaces:**

- Produces:
  - `RowMenu({label: string, items: {label: string; onSelect: () => void; tone?: 'danger'}[]})` — Radix `DropdownMenu`; trigger is a `Button size="icon" variant="ghost"` with `aria-label={label}` showing lucide `MoreHorizontal`.
  - `DataTable<T>({caption, rows: T[], rowKey: (r: T) => string, columns: Column<T>[], menu?: (r: T) => RowMenuItem[], empty?: ReactNode})` where `Column<T> = {header: string; cell: (r: T) => ReactNode; className?: string; primary?: boolean}`. Desktop (`md+`): a real `<table>` whose rows are plates (`bg-card rounded-plate`, `border-separate border-spacing-y-1.5`). Below `md`: a `<ul>` of cards; the `primary` column is the card title, others render as `header: value` lines. Both layouts are in the DOM, toggled with `hidden md:table` / `md:hidden` (CSS only; tests query by role inside the visible container via `within`). Long text cells get `max-w-[16rem] truncate` (desktop) and `break-all` (mobile).

- [ ] **Step 1: Failing test**

```tsx
import {fireEvent, render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {DataTable} from './data-table'

type Row = {id: string; nick: string; email: string}
const rows: Row[] = [
  {id: '1', nick: 'Steve', email: `${'a'.repeat(240)}@example.com`},
  {id: '2', nick: 'Alex', email: 'alex@example.com'}
]

function setup(onOpen = jest.fn()) {
  render(
    <DataTable
      caption="Orders"
      rows={rows}
      rowKey={r => r.id}
      columns={[
        {header: 'Nick', cell: r => r.nick, primary: true},
        {header: 'Email', cell: r => r.email}
      ]}
      menu={r => [{label: 'Open', onSelect: () => onOpen(r.id)}]}
    />
  )
  return onOpen
}

describe('DataTable', () => {
  it('renders a captioned table and a mobile list with the same rows', () => {
    setup()
    const table = screen.getByRole('table', {name: 'Orders'})
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + 2
    const list = screen.getByRole('list', {name: 'Orders'})
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('truncates long cells on desktop and wraps them on mobile', () => {
    setup()
    const cell = within(screen.getByRole('table')).getByText(/@example\.com$/, {
      selector: 'td *, td'
    })
    expect(cell.closest('td')?.innerHTML).toMatch(/truncate/)
    const mobile = within(screen.getByRole('list', {name: 'Orders'})).getAllByText(
      /a{240}@example\.com/
    )[0]
    expect(mobile.className).toMatch(/break-all/)
  })

  it('opens the row menu from the keyboard and runs the item', async () => {
    const user = userEvent.setup()
    const onOpen = setup()
    const table = screen.getByRole('table')
    const trigger = within(table).getAllByRole('button', {name: 'Actions for Steve'})[0]
    trigger.focus()
    await user.keyboard('{Enter}')
    const item = await screen.findByRole('menuitem', {name: 'Open'})
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith('1')
    expect(item).not.toBeInTheDocument()
  })

  it('returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = within(screen.getByRole('table')).getAllByRole('button', {
      name: 'Actions for Steve'
    })[0]
    trigger.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('shows the empty slot when there are no rows', () => {
    render(
      <DataTable
        caption="Orders"
        rows={[]}
        rowKey={() => ''}
        columns={[]}
        empty={<p>No orders found.</p>}
      />
    )
    expect(screen.getByText('No orders found.')).toBeInTheDocument()
    fireEvent.click(document.body)
  })
})
```

If `@testing-library/user-event` is not installed in admin, add it as a dev dependency (`pnpm --filter @shop/admin add -D @testing-library/user-event`). Radix menus need `PointerEvent`/`ResizeObserver` in jsdom: add minimal polyfills to `apps/admin/jest.setup.ts` if the test errors on them (`window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }`; `HTMLElement.prototype.scrollIntoView ??= () => {}`; `HTMLElement.prototype.hasPointerCapture ??= () => false`).

The menu label is `Actions for <primary cell text>`: DataTable passes `label` built from the row's `primary` column when it renders to a string; otherwise `Actions`.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

```tsx
// row-menu.tsx
'use client'

import * as Menu from '@radix-ui/react-dropdown-menu'
import {MoreHorizontal} from 'lucide-react'

import {Button} from '@shop/ui/button'
import {cn} from '@shop/ui/lib/utils'

export type RowMenuItem = {label: string; onSelect: () => void; tone?: 'danger'}

export function RowMenu({label, items}: {label: string; items: RowMenuItem[]}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal aria-hidden />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="rounded-plate border-border bg-card-raised z-50 min-w-44 border p-1 shadow-xl shadow-black/40">
          {items.map(item => (
            <Menu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(
                'data-[highlighted]:bg-card flex h-9 cursor-pointer items-center rounded-[10px] px-3 text-[13px] outline-none',
                item.tone === 'danger' ? 'text-bad' : 'text-fg'
              )}>
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
```

```tsx
// data-table.tsx
'use client'

import type {ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {RowMenu, type RowMenuItem} from './row-menu'

export type Column<T> = {
  header: string
  cell: (r: T) => ReactNode
  className?: string
  primary?: boolean
}

export function DataTable<T>({
  caption,
  rows,
  rowKey,
  columns,
  menu,
  empty
}: {
  caption: string
  rows: T[]
  rowKey: (r: T) => string
  columns: Column<T>[]
  menu?: (r: T) => RowMenuItem[]
  empty?: ReactNode
}) {
  if (rows.length === 0) return <>{empty}</>
  const primary = columns.find(c => c.primary) ?? columns[0]
  const menuLabel = (r: T) => {
    const v = primary?.cell(r)
    return typeof v === 'string' ? `Actions for ${v}` : 'Actions'
  }
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-y-1.5 md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.header} scope="col" className="label-caps px-4 pb-1 text-left">
                {c.header}
              </th>
            ))}
            {menu && (
              <th scope="col" className="w-12">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className="group">
              {columns.map((c, i) => (
                <td
                  key={c.header}
                  className={cn(
                    'bg-card group-hover:bg-card-raised px-4 py-3 text-[13px] transition-colors',
                    i === 0 && 'rounded-l-plate',
                    i === columns.length - 1 && !menu && 'rounded-r-plate',
                    c.className
                  )}>
                  <div className="max-w-[16rem] truncate">{c.cell(r)}</div>
                </td>
              ))}
              {menu && (
                <td className="rounded-r-plate bg-card group-hover:bg-card-raised px-2 text-right">
                  <RowMenu label={menuLabel(r)} items={menu(r)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map(r => (
          <li key={rowKey(r)} className="rounded-plate bg-card flex items-start gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="font-semibold break-all">{primary?.cell(r)}</div>
              {columns
                .filter(c => c !== primary)
                .map(c => (
                  <div key={c.header} className="flex gap-2 text-[13px]">
                    <span className="text-muted w-20 shrink-0">{c.header}</span>
                    <span className="min-w-0 break-all">{c.cell(r)}</span>
                  </div>
                ))}
            </div>
            {menu && <RowMenu label={menuLabel(r)} items={menu(r)} />}
          </li>
        ))}
      </ul>
    </>
  )
}
```

Note the mobile `<span className="min-w-0 break-all">` wraps the cell, so the test's `getAllByText(...)[0].className` reads the span — keep the class on the element that directly contains the text.

- [ ] **Step 4: Run** → PASS. **Step 5:** gate, commit `feat(admin): row menu and plate data table`.

---

### Task 6: Shell — rail, top bar, mobile sheet

**Files:**

- Modify: `apps/admin/src/config/nav.ts` (add `icon`), `apps/admin/src/app/(shell)/layout.tsx`, `apps/admin/src/app/(shell)/_components/nav.tsx`, `nav.test.tsx`
- Create: `apps/admin/src/app/(shell)/_components/{top-bar,mobile-nav,global-search}.tsx`
- Test: `apps/admin/src/app/(shell)/_components/shell.test.tsx`

**Interfaces:**

- Consumes: `Button` (Task 2), lucide icons.
- Produces: `NAV` entries `{href, label, icon: LucideIcon, permission?, match?}` — icons: Home `LayoutGrid`, Orders `ReceiptText`, Catalog `Boxes`, Content `FileText`, Team `Users`, Audit log `ScrollText`, Account `UserRound`. `Nav({me, variant: 'rail' | 'sheet', onNavigate?})`. `GlobalSearch` submits `router.push('/orders?q=' + encodeURIComponent(q))`; its input label is `Search orders`.

Layout (desktop): `grid min-h-screen grid-cols-[auto_1fr] gap-4 p-4`; rail `sticky top-4 hidden h-[calc(100vh-2rem)] w-[72px] flex-col items-center gap-2 rounded-full bg-surface py-4 md:flex`: brand mark (a 40 px accent circle with `S`), nav icons (`size-11 rounded-full`, active `bg-fg text-bg`, others `text-muted hover:bg-card-raised`), spacer, avatar initial circle linking to `/account`. Rail links keep their accessible name: `<Link aria-label={item.label} title={item.label}>` with the icon `aria-hidden` (the e2e uses `getByRole('link', {name: 'Orders'})`). Main column: `TopBar` (`flex h-14 items-center gap-3`): on mobile a `Menu` icon button `aria-label="Open menu"` opening `MobileNav` (Radix Dialog as a left sheet, `Dialog.Title` "Menu", nav `variant="sheet"` with icon + label rows, closes on navigate); `GlobalSearch` (pill input, `max-w-md flex-1`, only when the user has `order.read`); user email + role on the right (`hidden sm:block`). Content `main` with `mx-auto w-full max-w-[1400px] pb-12`.

Mobile duplication caution: both the rail and the sheet render nav links; the sheet's links exist only while open, and the rail is `hidden` (display:none) below `md`, so `getByRole('link', {name: 'Orders'})` resolves to one visible link at any width.

- [ ] **Step 1: Failing test** `shell.test.tsx`

```tsx
import {fireEvent, render, screen, within} from '@testing-library/react'

import type {Me} from '@shop/shared/access'

import {GlobalSearch} from './global-search'
import {MobileNav} from './mobile-nav'
import {Nav} from './nav'

const push = jest.fn()
jest.mock('next/navigation', () => ({usePathname: () => '/orders', useRouter: () => ({push})}))

const me = {
  id: 'u1',
  email: 'owner@shop.localhost',
  name: 'Owner',
  role: {id: 'r', name: 'OWNER'},
  permissions: ['order.read', 'audit.read', 'admin.invite', 'content.write']
} as unknown as Me

describe('shell', () => {
  it('rail links are named by label and mark the current page', () => {
    render(<Nav me={me} variant="rail" />)
    const orders = screen.getByRole('link', {name: 'Orders'})
    expect(orders).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })

  it('hides entries the user lacks permission for', () => {
    render(<Nav me={{...me, permissions: []} as Me} variant="rail" />)
    expect(screen.queryByRole('link', {name: 'Orders'})).toBeNull()
    expect(screen.getByRole('link', {name: 'Catalog'})).toBeInTheDocument()
  })

  it('global search sends the query to the orders page', () => {
    render(<GlobalSearch />)
    fireEvent.change(screen.getByLabelText('Search orders'), {target: {value: 'Steve 1'}})
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/orders?q=Steve%201')
  })

  it('mobile menu opens as a dialog with the nav and closes on navigate', () => {
    render(<MobileNav me={me} />)
    fireEvent.click(screen.getByRole('button', {name: 'Open menu'}))
    const dialog = screen.getByRole('dialog', {name: 'Menu'})
    fireEvent.click(within(dialog).getByRole('link', {name: 'Catalog'}))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

Update `nav.test.tsx` to pass `variant="rail"` (or fold its cases into `shell.test.tsx` and delete it).

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** as described above (Radix `Dialog.Root` controlled with `useState`; `Dialog.Content` `fixed inset-y-0 left-0 w-72 bg-surface p-4`; `Dialog.Overlay` `fixed inset-0 bg-black/60`). **Step 4: Run** → PASS.

- [ ] **Step 5: Gate and commit** — `feat(admin): rail shell with search and mobile menu`.

---

### Task 7: Dashboard

**Files:**

- Modify: `apps/admin/src/app/(shell)/page.tsx`
- Create: `apps/admin/src/features/dashboard/components/dashboard.tsx`, `apps/admin/src/features/dashboard/components/quick-links.tsx`
- Test: `apps/admin/src/features/dashboard/components/dashboard.test.tsx`

**Interfaces:**

- Consumes: `useGetOrderStatsQuery`, `useListAdminOrdersQuery` (Task 1/existing), `KpiCard`, `DayChart`, `Ring`, `Card`, `StatusDot`, `DataTable`, `EmptyState`, `Skeleton`, `PageHeader`, format helpers.
- Produces: `Dashboard()` client component.

Page: server component keeps `<h1>` "Welcome, {name || email}" via `PageHeader` (e2e `/^Welcome/`), description "Here is how the shop is doing." If the user has `order.read` render `<Dashboard />`, else `<QuickLinks me={me} />` (cards linking to the sections the user can open, using `NAV` minus Home).

Dashboard layout (`grid gap-4`):

1. Toolbar right-aligned: range `Tabs` (`7 days` / `30 days`).
2. KPI row `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`: Revenue EUR (`tone="accent"`, spark from daily EUR), Revenue PLN (spark PLN), Paid orders (delta vs previous, spark paid per day), Conversion (`formatPercent`, hint `"{expired} expired"`).
3. Row `grid gap-4 xl:grid-cols-[2fr_1fr]`: Card "Revenue per day" with a currency toggle (EUR/PLN tabs) and `DayChart`; Card "Orders by status" with `Ring` (conversion) and a list of `StatusDot` + count for statuses with count > 0 (or `EmptyState` "No orders in this range.").
4. Row `grid gap-4 xl:grid-cols-2`: Card "Top products" (ordered list: rank, name, server, quantity; empty state "No sales in this range."); Card "Latest orders" with action link "All orders" → `/orders`, showing first 5 rows of `useListAdminOrdersQuery({})` in a compact `DataTable` (Order number mono, Nick, Total, Status).
   Loading: `Skeleton` blocks with the same grid shapes. Error: `role="alert"` card "Could not load statistics. Try again." with a Retry button calling `refetch`.

- [ ] **Step 1: Failing test**

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, within} from '@testing-library/react'

import {Dashboard} from './dashboard'

const days = (n: number, eur: number) =>
  Array.from({length: n}, (_, i) => {
    const day = new Date(Date.UTC(2026, 9, 17 - (n - 1 - i))).toISOString().slice(0, 10)
    return [
      {day, currency: 'EUR', totalMinor: i === n - 1 ? eur : 0, paidCount: i === n - 1 ? 1 : 0},
      {day, currency: 'PLN', totalMinor: 0, paidCount: 0}
    ]
  }).flat()

const stats = (over: Partial<Record<string, unknown>> = {}) => ({
  range: '7d',
  from: '2026-10-11T00:00:00.000Z',
  to: '2026-10-17T12:00:00.000Z',
  revenue: [
    {currency: 'EUR', totalMinor: 1250, previousMinor: 1000},
    {currency: 'PLN', totalMinor: 0, previousMinor: 0}
  ],
  paidCount: 1,
  previousPaidCount: 0,
  expiredCount: 1,
  conversion: 0.5,
  byStatus: [
    {status: 'PAID', count: 1},
    {status: 'EXPIRED', count: 1}
  ],
  daily: days(7, 1250),
  topProducts: [{productId: 'p1', name: 'VIP', serverName: 'Anarchy', quantity: 3}],
  ...over
})

function mockApi(body: unknown) {
  return jest.spyOn(global, 'fetch').mockImplementation(input => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.pathname.endsWith('/stats/orders')) return Promise.resolve(Response.json(body))
    return Promise.resolve(Response.json({orders: [], nextCursor: null}))
  })
}

describe('Dashboard', () => {
  it('shows revenue, paid orders, conversion and top products', async () => {
    mockApi(stats())
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('region', {name: 'Revenue EUR'})).toHaveTextContent('€12.50')
    expect(screen.getByRole('region', {name: 'Revenue EUR'})).toHaveTextContent('+25%')
    expect(screen.getByRole('region', {name: 'Conversion'})).toHaveTextContent('50%')
    expect(
      within(screen.getByRole('region', {name: 'Top products'})).getByText('VIP')
    ).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Revenue per day/})).toBeInTheDocument()
  })

  it('shows dashes and empty states on an empty range instead of NaN', async () => {
    mockApi(
      stats({
        revenue: [
          {currency: 'EUR', totalMinor: 0, previousMinor: 0},
          {currency: 'PLN', totalMinor: 0, previousMinor: 0}
        ],
        paidCount: 0,
        expiredCount: 0,
        conversion: null,
        byStatus: [],
        daily: days(7, 0),
        topProducts: []
      })
    )
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('region', {name: 'Conversion'})).toHaveTextContent('—')
    expect(screen.getByText('No sales in this range.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('switches the range to 30 days', async () => {
    const fetchMock = mockApi(stats())
    renderWithStore(<Dashboard />)
    await screen.findByRole('region', {name: 'Revenue EUR'})
    fireEvent.mouseDown(screen.getByRole('tab', {name: '30 days'}))
    fireEvent.click(screen.getByRole('tab', {name: '30 days'}))
    await screen.findByRole('region', {name: 'Revenue EUR'})
    const urls = (fetchMock.mock.calls as [unknown][]).map(([r]) =>
      String(r instanceof Request ? r.url : r)
    )
    expect(urls.some(u => u.includes('range=30d'))).toBe(true)
  })

  it('offers a retry when statistics fail to load', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', {status: 500}))
    renderWithStore(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load statistics')
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument()
  })
})
```

Add one page-level test (`apps/admin/src/app/(shell)/page.test.tsx`, mocking `@/lib/session` `requireMe`) asserting that a user without `order.read` sees the `Welcome` heading and quick-link cards and no `Dashboard` (no `region` named "Revenue EUR"), covering Review Focus 2.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Gate and commit** — `feat(admin): dashboard with order statistics`.

---

### Task 8: Orders list and order details

**Files:**

- Modify: `apps/admin/src/features/orders/components/orders-table.tsx`, `order-details.tsx`, their tests; `apps/admin/src/app/(shell)/orders/page.tsx`, `orders/[id]/page.tsx`

**Interfaces:**

- Consumes: `DataTable`, `RowMenu`, `StatusDot`, `PageHeader`, `Card`, `EmptyState`, `SkeletonRows`, `Tabs`, `formatMoney`, `formatTime`.
- Produces: `OrdersTable({initialQ?: string})`.

Orders page: `PageHeader` title `Orders`, description `Every checkout, newest first.`; reads `searchParams.q` and passes `initialQ`. `OrdersTable`:

- Status tabs (`Tabs`, labelled `Status`): All, Paid, Delivered, Pending, Expired (Radix tabs used as a filter; selecting resets cursors). Ruling recorded in the plan: the spec's "Problem" tab arrives with 5a, because in 4a no order can reach a problem state (refunds and disputes do not exist yet); 5a adds it with delivery failures.
- Search form kept: `role="search"`, label `Search by nick, email or order number` (keep exactly), pill input + `Search` button; initial value from `initialQ`.
- Rows via `DataTable` (caption `Orders`): columns Order (primary; `publicId` in `font-mono`, link to `/orders/{id}`), Date (`formatTime`), Nick, Email, Total (`tabular`, right aligned), Status (`StatusDot`). Pages: keep the existing cursor-chain logic (`PageRows`), but each page renders its own `DataTable` block stacked one after another; "Load more" is an `outline` button below.
- Row menu items: `Open` (router push), `Copy order number` (`navigator.clipboard.writeText(publicId)`), `Copy email`. Ruling: "Copy public link" from the spec becomes "Copy order number" because the admin does not know the storefront origin; the order number is what support pastes into the shop URL or a reply.
- Loading: `SkeletonRows`. Empty: `EmptyState` (icon `ReceiptText`) "No orders found." Error: keep the existing 403 / generic messages with `role="alert"`.

Order details: `PageHeader` title `Order {publicId}` with `StatusDot` and a `Back to orders` ghost link; grid `lg:grid-cols-[2fr_1fr]`: left Card "Items" grouped by server (server name as a small heading, rows name × qty, unit price, line total, then subtotal / discount / total rows); right column Card "Buyer" (nick, email with copy button, locale) and Card "Payment" (total, currency, Stripe session link via `stripeSessionUrl`, consent time) and Card "Timeline" (created, paid, current status) as a vertical list with dots. Keep every text the current `order-details.test.tsx` asserts, except status words (now `Paid` etc.).

- [ ] **Step 1: Update tests first** — in `orders-table.test.tsx`: rows are found with `within(screen.getByRole('table', {name: 'Orders'}))`; status text `Paid`; add:

```tsx
it('filters by the status tab', async () => {
  const fetchMock = mockApi()
  renderWithStore(<OrdersTable />)
  await screen.findAllByText('SHOP-o1')
  fireEvent.mouseDown(screen.getByRole('tab', {name: 'Expired'}))
  fireEvent.click(screen.getByRole('tab', {name: 'Expired'}))
  await waitFor(() => {
    expect(requestedUrls(fetchMock).some(u => u.searchParams.get('status') === 'EXPIRED')).toBe(
      true
    )
  })
})

it('starts with the query from the URL', async () => {
  const fetchMock = mockApi()
  renderWithStore(<OrdersTable initialQ="steve" />)
  expect(screen.getByLabelText('Search by nick, email or order number')).toHaveValue('steve')
  await waitFor(() => {
    expect(requestedUrls(fetchMock).some(u => u.searchParams.get('q') === 'steve')).toBe(true)
  })
})

it('copies the order number from the row menu', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.assign(navigator, {clipboard: {writeText}})
  mockApi()
  const user = userEvent.setup()
  renderWithStore(<OrdersTable />)
  const table = await screen.findByRole('table', {name: 'Orders'})
  await user.click(within(table).getByRole('button', {name: 'Actions for SHOP-o1'}))
  await user.click(await screen.findByRole('menuitem', {name: 'Copy order number'}))
  expect(writeText).toHaveBeenCalledWith('SHOP-o1')
})
```

(The primary column renders a link, not a string, so `DataTable`'s menu label would be `Actions`; pass the primary column's `cell` as the link and give `DataTable` an optional `rowLabel?: (r: T) => string` prop — add it in this task with a one-line test in `data-table.test.tsx` — and use `rowLabel={o => o.publicId}`.)

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm --filter @shop/admin test` → PASS.
- [ ] **Step 5: Gate and commit** — `feat(admin): order list with status tabs, row menu and new order page`.

---

### Task 9: Catalog board as preview cards

**Files:**

- Create: `apps/admin/src/features/catalog/components/{product-icon,server-card,product-card,add-card}.tsx`
- Modify: `apps/admin/src/features/catalog/components/catalog-board.tsx`, `catalog-board.test.tsx`; `apps/admin/src/app/(shell)/catalog/page.tsx`

**Interfaces:**

- Consumes: `SortableList` (unchanged API), `useOptimisticOrder`, generated catalog hooks, `PageHeader`, `ToneDot`.
- Produces: `ProductIcon({name, className})` (same lucide map as `apps/web/src/features/catalog/components/product-icon.tsx`); `ServerCard({server, selected, onSelect, handle?})`; `ProductCard({product, server, href, handle?})`; `AddCard({href, label})`.

Board layout:

- `PageHeader` "Catalog", description "Servers, categories and products. Changes are live on the site within a minute." (moves the old footer sentence), actions: `+ Server` (outline, when `canEdit`) and `Manage categories` (ghost).
- Server strip: `role="tablist" aria-label="Server"` with a horizontal `SortableList` of `ServerCard`s (`role="tab"`, `aria-selected`), each `min-w-56 rounded-card p-4` filled with `server.accent`, text in `server.onAccent`: name (16 px semibold), `{productCount} products`, RCON state via a small pill on a translucent `onAccent` ground: "RCON ready" when `rconPasswordSet && rcon?.host`, "RCON not set" otherwise (text, not colour only), "Disabled" pill when `!isActive`. Drag handle button `Move {name}` stays (top-right, `onAccent` colour). A dashed `AddCard` "+ Server" closes the strip when `canEdit`.
- Selected server: per category a section with `h2` category name, the attach/detach controls as today, and a responsive grid `grid gap-3 sm:grid-cols-2 xl:grid-cols-4` rendered by `SortableList` (keep `label={`Products in ${name}`}` so the list name stays) of `ProductCard`s + `AddCard` with link text `+ Product in {category}` (exact, e2e).
- `ProductCard`: `rounded-card bg-card p-3 flex flex-col gap-3`; top plate `aspect-[4/3] rounded-plate grid place-items-center` with background `color-mix(in oklab, {server.accent} 22%, transparent)` and the `ProductIcon` at `size-12` in `server.accent`; `mark` as a mono pill in the plate corner; below: product name as the link (`<Link href>` whose accessible name is exactly the product name — e2e reads list links' text), kind pill (`Permanent` / `Timed · {n} d` / `Case`), prices `€x.xx · y zł` (`tabular`, `text-muted`), `Disabled` `ToneDot` (idle) when inactive, `Missing PL` warn pill when translations are missing (data already in the list item if present; skip if not in `AdminProductListItem`). Drag handle `Move {name}` in the card's top-right corner (visible on hover and on focus; always visible on touch via `@media (hover: none)`).

- [ ] **Step 1: Update tests** — keep every existing behavioural case in `catalog-board.test.tsx` (ordering, attach/detach, permissions) and adjust queries only where markup changed. Add:

```tsx
it('server cards use the server colours and say whether RCON is set', async () => {
  mockApi()
  renderWithStore(<CatalogBoard canEdit />)
  const tab = await screen.findByRole('tab', {name: /Anarchy/})
  expect(tab).toHaveStyle({color: 'rgb(14, 14, 16)'}) // onAccent from the fixture
  expect(within(tab).getByText(/RCON (ready|not set)/)).toBeInTheDocument()
})

it('product cards link by name and keep the add link per category', async () => {
  mockApi()
  renderWithStore(<CatalogBoard canEdit />)
  const list = await screen.findByRole('list', {name: 'Products in Ranks'})
  expect(
    within(list)
      .getAllByRole('link')
      .map(l => l.textContent)
  ).toContain('VIP')
  expect(screen.getByRole('link', {name: '+ Product in Ranks'})).toBeInTheDocument()
})
```

Adapt fixture values (server names, accent/onAccent, category names) to the ones the existing test file's `mockApi` already uses; if its fixture has no `onAccent`, set it to `#0e0e10`.

Note on the list: if `ProductCard` contains only one link, `within(list).getAllByRole('link')` keeps returning product names in order, as the e2e expects; the `AddCard` must sit outside the `SortableList` `<ul>`.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Gate and commit** — `feat(admin): catalog as server and product preview cards`.

---

### Task 10: Catalog editors with live preview

**Files:**

- Modify: `apps/admin/src/features/catalog/components/{server-editor,product-editor,rcon-panel,sections-editor,categories-table}.tsx` and the pages under `apps/admin/src/app/(shell)/catalog/**`

**Interfaces:**

- Consumes: `FormSection`, `PageHeader`, `Card`, `ServerCard`, `ProductCard` (Task 9), `DataTable`, `EmptyState`, restyled primitives.

Rules for this task (no behaviour change):

- Every field keeps its `<Label>` text and id; every button keeps its name (`Save`, `Delete`, `Confirm delete`, tab `PL`, etc.); validation messages unchanged.
- Product editor: page = `PageHeader` ("New product" / product name) + `grid gap-4 xl:grid-cols-[1fr_20rem]`. Left: `FormSection`s — "Basics" (slug, category, kind, duration, icon, mark, enabled), "Prices" (EUR, PLN), "Texts" (EN/PL tabs: name, description, sections editor), "Commands" (grant, revoke, in `font-mono` textareas). Right (sticky `top-4`, `hidden xl:block`): "Preview" `ProductCard` fed from the live form values (`useWatch`), with the selected server's accent.
- Server editor: same split; sections "Basics" (name, slug, accent + onAccent colour inputs with swatches, enabled), "RCON" (existing `RconPanel` restyled inside a `FormSection`); preview `ServerCard`. Show a contrast warning pill when `accent`/`onAccent` contrast ratio < 4.5 (small helper `contrastRatio(hexA, hexB)` in `apps/admin/src/lib/contrast.ts` with a unit test: black/white = 21, equal colours = 1).
- Categories: `PageHeader` "Categories" + `DataTable` (Name EN primary, Name PL, Slug mono, Used by N servers) with row menu (Edit, Delete as danger) mapping to the existing actions; the create form becomes a `FormSection` card above the table.
- Delete confirmations keep their current flow and button names.

- [ ] **Step 1: Tests first** — add `apps/admin/src/lib/contrast.test.ts`:

```ts
import {contrastRatio} from './contrast'

it('computes WCAG contrast ratios', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  expect(contrastRatio('#ffffff', '#ffc857')).toBeLessThan(4.5)
})
```

and in `server-editor.test.tsx` a case: entering accent `#ffffff` and onAccent `#ffc857` shows `Low contrast`. In `product-editor.test.tsx` a case: typing a name updates the preview card (`within(screen.getByRole('region', {name: 'Preview'}))` contains the typed name). Run the full existing editor tests to confirm they still pass on the old markup before restyling.

```ts
// lib/contrast.ts
const lum = (hex: string) => {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0)
}
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
```

- [ ] **Step 2: Run** → new cases FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm --filter @shop/admin test` → PASS.
- [ ] **Step 5: Gate and commit** — `feat(admin): catalog editors in form sections with live preview`.

---

### Task 11: Team, audit, account, content and auth screens

**Files:**

- Modify: `apps/admin/src/features/team/components/*`, `features/audit/components/audit-table.tsx`, `features/auth/components/*`, `features/content/components/*`, pages under `app/(shell)/{team,audit,account,content}` and `app/(auth)/*`

Rules (no behaviour change; keep labels, button names, tab names, messages):

- Every page starts with `PageHeader` (Team: "Team" / "Admins, invites and role permissions."; Audit log: "Audit log" / "Who changed what, newest first."; Account: "Account"; Content: "Content" with its section tabs restyled as pill `Tabs`/links).
- Tables (admins, invites, audit, texts) become `DataTable` with row menus for their existing row actions (admins: Change role, Remove; invites: Revoke; texts: Edit, Reset). Where an existing test clicks an inline button by name, keep that name as the menu item label and update the test to open the row menu first (`Actions for <primary>`).
- Roles matrix stays a real `<table>` (it is a grid of checkboxes, not rows of records) inside a `Card`, with sticky first column and horizontal scroll inside the card on mobile (`overflow-x-auto` on the card body, never the page).
- Rules editor and settings form: `FormSection`s; rules preview inside a `Card` titled "Preview"; versions list as a compact `DataTable`.
- Auth pages (login, 2FA, invite): centered `Card` (`max-w-sm`, `mx-auto mt-[12vh]`) with the brand mark above; backup codes in `font-mono` grid.
- Empty states: invites "No pending invites.", audit "Nothing logged yet.", texts filter "No texts match."

- [ ] **Step 1:** Run `pnpm --filter @shop/admin test` on the current tree (baseline green). **Step 2:** For each component, restyle, then update only the queries its tests need (row menus). Add one test: audit table at mobile shows a list (`getByRole('list', {name: 'Audit log'})`) — DataTable caption "Audit log". **Step 3:** Run → PASS.
- [ ] **Step 4: Gate and commit** — `feat(admin): restyle team, audit, account, content and sign-in screens`.

---

### Task 12: e2e coverage and mobile check

**Files:**

- Modify: `e2e/tests/admin.spec.ts`

Add to the serial admin group (chromium only, after the owner can sign in; reuse `signInWithCode` / `ownerCode`):

```ts
test('the owner sees the dashboard and can open an order row menu with the keyboard', async ({
  page
}) => {
  await page.goto(`${ADMIN}/login`)
  await signInWithCode(page, OWNER)
  await page.getByLabel('Code from the app').fill(await ownerCode(page))
  await page.getByRole('button', {name: 'Verify'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()
  await expect(page.getByRole('region', {name: 'Revenue EUR'})).toBeVisible()
  await expect(page.getByRole('region', {name: 'Conversion'})).toBeVisible()

  await page.getByRole('link', {name: 'Orders'}).click()
  await expect(page.getByRole('heading', {name: 'Orders'})).toBeVisible()
  const table = page.getByRole('table', {name: 'Orders'})
  if ((await table.count()) > 0 && (await table.getByRole('row').count()) > 1) {
    const trigger = table.getByRole('button', {name: /^Actions for /}).first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', {name: 'Open'})).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  }

  await page.setViewportSize({width: 390, height: 844})
  for (const path of ['/', '/orders', '/catalog', '/team', '/audit']) {
    await page.goto(`${ADMIN}${path}`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(0)
  }
  await page.getByRole('button', {name: 'Open menu'}).click()
  await expect(
    page.getByRole('dialog', {name: 'Menu'}).getByRole('link', {name: 'Orders'})
  ).toBeVisible()
})
```

The e2e checkout spec creates paid orders in the same stack only when it runs before; the row-menu block is guarded so the test does not depend on spec order. Existing admin tests must keep passing unchanged except where Tasks 6–11 changed a selector (record each change in the commit message body).

- [ ] **Step 1:** Write the test. **Step 2:** Run the e2e stack locally per `docs/runbooks/` / CI notes using the `shop-e2e` project only (`docker compose -p shop-e2e -f compose.e2e.yaml up -d --build --wait`, then `pnpm --filter e2e exec playwright test admin`), never `down -v` on the default project. Expected: admin specs PASS. **Step 3:** Tear down with `docker compose -p shop-e2e -f compose.e2e.yaml down -v`.
- [ ] **Step 4: Gate and commit** — `test(e2e): admin dashboard, row menu and mobile layout`.

---

### Task 13: Visual QA, finish review and DESIGN.md

**Files:**

- Create: `DESIGN.md` admin section (via the impeccable documenter), `.impeccable/review/admin-*.png` (gitignored if the folder is ignored; otherwise do not commit screenshots)
- Modify: `CLAUDE.md` (one bullet: admin UI uses `apps/admin/src/components/` + tokens; see DESIGN.md)

- [ ] **Step 1:** Run admin + api + seed locally (or the `shop-e2e` stack) and capture desktop 1440 and mobile 390 screenshots of `/`, `/orders`, `/orders/[id]`, `/catalog`, a product editor, `/team`. Compare once against the spec §2–4 and the owner references in `references-admin/` (local only). Fix everything found in one batch; one confirmation round; stop.
- [ ] **Step 2:** Dispatch the shipped `impeccable-finish-reviewer` with the surface brief `apps/admin/.impeccable/surfaces/apps-admin.md` and the screenshots; apply material fixes it lists (one batch).
- [ ] **Step 3:** Dispatch `impeccable-documenter` to write the admin section of `DESIGN.md` from the built code (tokens, components, rules: one accent card per screen, status = dot + label, plate rows, preview cards).
- [ ] **Step 4:** Add the CLAUDE.md bullet. Gate, commit `docs: admin design system`.
