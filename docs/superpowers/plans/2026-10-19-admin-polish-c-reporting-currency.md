# Admin polish C — Reporting currency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every paid order stores the EUR→PLN rate fixed at payment and its total in both currencies; the dashboard reads in one chosen currency (EUR or PLN) with revenue, paid orders, average order, conversion and LTV, one revenue chart, and a donut of paid orders by original currency.

**Architecture:** An `ExchangeRates` port in `apps/api/src/rates/` (NBP adapter for real use, fixed-rate adapter for e2e and tests, picked by env like `PaymentsGateway`). `OrderRatesService.fill(orderId)` runs after the PAID commit and an hourly sweep fills any order still missing a rate. `OrdersStatsService` sums the stored per-currency totals. The admin dashboard gets a currency selector and the new KPIs.

**Tech Stack:** NestJS 11, Prisma (Postgres `Decimal`), valibot contract in `@shop/shared/orders`, RTK Query codegen, Jest (+ `*.int-spec.ts` against Postgres), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-polish-design.md` (part 6). Builds on plans A/B UI primitives.

## Global Constraints

- Money stays `Int` minor units. The rate is the only non-integer: Postgres `Decimal(10,4)` on `orders.eurPlnRate` (PLN per 1 EUR), arithmetic with `Prisma.Decimal`, never a JS float.
- Stored once, never recomputed: `eurPlnRate`, `totalEurMinor`, `totalPlnMinor`, `rateDate` (the NBP table date used). Original `currency`/`totalMinor` unchanged.
- Rounding: half-up to minor units. EUR order: `totalPlnMinor = round(totalMinor × rate)`, `totalEurMinor = totalMinor`. PLN order: `totalEurMinor = round(totalMinor ÷ rate)`, `totalPlnMinor = totalMinor`.
- Rate source: NBP table A mid for EUR from the **last table published before the Europe/Warsaw calendar day of `paidAt`** (previous business day). Endpoint: `GET https://api.nbp.pl/api/exchangerates/rates/a/eur/{from}/{to}/?format=json` with `to = paidDay − 1`, `from = paidDay − 10`; take the last entry of `rates` (`{effectiveDate, mid}`). NBP returns 404 when the range has no table.
- Payment handling must never fail or wait because of NBP (ADR 0010: side effects after commit). If NBP is down, fields stay null; the sweep fills them later.
- `EXCHANGE_RATES`: `nbp` (default) or `fixed` (`FIXED_EUR_PLN`, default `4.3000`). The e2e compose sets `fixed`. Add both to `.env.example`.
- Stats exclude orders whose rate is still null from converted sums and report their count as `awaitingRate`.
- LTV = converted revenue ÷ distinct `lower(email)` among paid orders (with a rate) in the range; `null` when there are none. Average order = converted revenue ÷ paid orders with a rate; `null` when none.
- Dashboard keeps: "vs previous period" deltas (previous period converted the same way), orders-by-status donut, top products, latest orders. Removes the "Revenue EUR"/"Revenue PLN" pair and the chart's EUR/PLN tabs. One accent card (Revenue). Default currency EUR, remembered per browser in `localStorage` key `admin.reportCurrency` (try/catch).
- Every admin route stays documented in `apps/api/src/openapi/` (`admin-routes.spec.ts`); regenerate admin RTK Query (`pnpm --filter @shop/admin codegen`).
- Gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int`; `graphify update .`; Conventional Commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. An order paid at 00:30 Warsaw time on a Monday must use Friday's table (the previous business day in Warsaw, not UTC).
2. Two API replicas filling the same order concurrently must write the same values once (conditional update `WHERE eurPlnRate IS NULL`).
3. NBP answering 404, 5xx, a timeout or malformed JSON must leave the order unchanged and not throw out of the webhook path.
4. A range where every paid order still awaits a rate must render "—" for average/LTV and a visible "N orders waiting for an exchange rate" note, not `NaN` or `€0.00`.
5. Switching EUR↔PLN on the dashboard must refetch and never show the previous currency's numbers labelled with the new one (`currentData`, not `data`).

---

### Task 1: Schema — rate and per-currency totals on `orders`

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (`model Order`)
- Create: `apps/api/prisma/migrations/20261020110000_order_exchange_rate/migration.sql` (via `prisma migrate dev --create-only`, then review)
- Test: `apps/api/test/orders-schema.int-spec.ts`

**Interfaces:**

- Produces on `Order`: `eurPlnRate Decimal? @db.Decimal(10, 4)`, `rateDate DateTime? @db.Date`, `totalEurMinor Int?`, `totalPlnMinor Int?`. No new index (the existing `@@index([status, createdAt])` and the stats' `paidAt` range are enough at this scale).

- [ ] **Step 1: Failing int test** — `an order stores a 4-decimal rate and both totals` (create, update with `eurPlnRate: new Prisma.Decimal('4.2875')`, read back `'4.2875'`).
- [ ] **Step 2: Run** `pnpm --filter @shop/api test:int -- orders-schema` — FAIL.
- [ ] **Step 3: Implement** schema + migration; `pnpm --filter @shop/api prisma generate`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api): exchange rate and per-currency totals on orders`

### Task 2: `ExchangeRates` port — NBP and fixed adapters

**Files:**

- Create: `apps/api/src/rates/exchange-rates.ts`, `nbp-rates.ts`, `fixed-rates.ts`, `create-rates.ts`, `warsaw-day.ts`, `rates.module.ts` and specs (`*.spec.ts`)
- Modify: `.env.example`, `compose.e2e.yaml` (api: `EXCHANGE_RATES: fixed`)

**Interfaces:**

- Produces:
  - `export const EXCHANGE_RATES = Symbol('EXCHANGE_RATES')`
  - `interface ExchangeRates { eurPlnBefore(day: string): Promise<{rate: string; date: string} | null> }` — `day` is `YYYY-MM-DD` (Warsaw); returns the last table strictly before it, `null` on 404/no data; throws on network/5xx/malformed so the caller can retry later.
  - `warsawDay(at: Date): string` — `Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Warsaw'})`.
  - `createExchangeRates(env): ExchangeRates` — `nbp` default; `fixed` uses `FIXED_EUR_PLN` (validate `/^\d+\.\d{1,4}$/`), date = the day before.
  - `NbpRates(fetchFn = fetch, timeoutMs = 5000)`; `rate` is `mid.toFixed(4)` (formatting only; all arithmetic happens later in `Prisma.Decimal`).
- [ ] **Step 1: Failing tests** — `warsawDay(new Date('2026-10-18T22:30:00Z')) === '2026-10-19'`; NBP: requests `/a/eur/2026-10-09/2026-10-18/` for day `2026-10-19`, returns the last `{effectiveDate, mid}` as `{rate: '4.2875', date: '2026-10-16'}`; 404 → `null`; 500 → throws; malformed → throws; timeout → throws. Fixed: `{rate: '4.3000', date: '2026-10-18'}`; bad `FIXED_EUR_PLN` throws at creation.
- [ ] **Step 2: Run** `pnpm --filter @shop/api test -- rates` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api): NBP and fixed exchange-rate adapters`

### Task 3: `OrderRatesService` — fill after payment and an hourly sweep

**Files:**

- Create: `apps/api/src/orders/order-rates.service.ts` (+ `.spec.ts` for the pure conversion), `apps/api/test/order-rates.int-spec.ts`
- Modify: `apps/api/src/orders/payment-events.service.ts` (after commit, next to `sendReceipt`), `orders.module.ts` (import `RatesModule`)

**Interfaces:**

- Consumes: `EXCHANGE_RATES` (Task 2), Order fields (Task 1).
- Produces:
  - `convertTotals(totalMinor: number, currency: 'EUR' | 'PLN', rate: string): {totalEurMinor: number; totalPlnMinor: number}` — `Prisma.Decimal`, `ROUND_HALF_UP`.
  - `OrderRatesService.fill(orderId: string): Promise<'filled' | 'pending' | 'skipped'>` — reads `paidAt`/`currency`/`totalMinor`; asks `eurPlnBefore(warsawDay(paidAt))`; `updateMany({where: {id, eurPlnRate: null}, data})`; catches and logs adapter errors → `'pending'`.
  - `OrderRatesService.sweep(limit = 200)` — paid/delivered orders with `paidAt` and null rate, oldest first, `fill` each sequentially.
  - Sweep scheduling: `onApplicationBootstrap` runs one sweep (backfills existing orders — this is the one-off backfill), then `setInterval(sweep, 60 * 60 * 1000).unref()`; cleared in `onModuleDestroy`. Skipped when `NODE_ENV === 'test'`.
- [ ] **Step 1: Failing tests** — unit: `convertTotals(1000, 'EUR', '4.2875')` → `{1000, 4288}`; `convertTotals(4300, 'PLN', '4.3000')` → `{1000, 4300}`; `convertTotals(1, 'PLN', '4.3000')` → EUR `0`. Int: paying a fake order fills rate `4.3000` and both totals; an adapter that throws leaves nulls and the webhook still returns 2xx and the receipt is sent; `sweep()` fills it later; two concurrent `fill` calls write once (second gets `count 0`); the Review Focus 1 case with a stubbed adapter asserting the requested day.
- [ ] **Step 2: Run** `pnpm --filter @shop/api test -- order-rates` and `test:int -- order-rates` — FAIL.
- [ ] **Step 3: Implement.** In `PaymentEventsService.apply`, after `sendReceipt`, `void this.rates.fill(paidNow.id)` wrapped so a rejection is logged, never thrown.
- [ ] **Step 4: Run** — PASS, plus `orders-webhook.int-spec.ts` unchanged and green.
- [ ] **Step 5: Commit** `feat(api): fix the EUR/PLN rate when an order is paid`

### Task 4: Stats in a reporting currency

**Files:**

- Modify: `packages/shared/src/orders.ts` (`OrderStatsQuerySchema`, `OrderStatsSchema`), `packages/shared/src/orders.spec.ts`
- Modify: `apps/api/src/orders/orders-stats.service.ts`, `apps/api/src/orders/orders-admin.controller.ts` (query passes through), `apps/api/src/openapi/orders-paths.ts` (`/api/admin/stats/orders`: `currency` query param, new response fields, descriptions)
- Modify: `apps/api/test/orders-stats.int-spec.ts`
- Run: `pnpm --filter @shop/api openapi` (or the repo's write-openapi script) and `pnpm --filter @shop/admin codegen`

**Interfaces:**

- Produces:
  - Query: `{range?: '7d' | '30d' = '7d', currency?: 'EUR' | 'PLN' = 'EUR'}`.
  - Response:
    ```ts
    {
      range, currency, from, to,
      revenueMinor: Minor, previousRevenueMinor: Minor,
      paidCount: Count, previousPaidCount: Count,
      averageMinor: Minor | null, ltvMinor: Minor | null, buyers: Count,
      awaitingRate: Count,
      expiredCount: Count, conversion: number | null,
      byStatus: {status, count}[],
      byCurrency: {currency, count: Count, totalMinor: Minor /* original currency */}[],
      daily: {day, totalMinor: Minor, paidCount: Count}[],   // in `currency`
      topProducts: (unchanged)
    }
    ```
  - Sums use `totalEurMinor`/`totalPlnMinor` by `currency` with `eurPlnRate IS NOT NULL`; `paidCount`, `byCurrency`, `conversion` count all paid orders; `awaitingRate` counts paid orders in range with a null rate. Days stay UTC (unchanged behaviour).
- [ ] **Step 1: Failing tests** — shared: schema accepts the new shape and rejects a missing `currency`. Int: with one EUR order (1000, rate 4.3) and one PLN order (4300) in range: `currency=EUR` → `revenueMinor 2000`, `averageMinor 1000`; `currency=PLN` → `8600`; same email in different case counts one buyer (`ltvMinor 2000`); an order without a rate → excluded from sums, `awaitingRate 1`, still in `paidCount` and `byCurrency`; all awaiting → `averageMinor null`, `ltvMinor null`; previous period converted.
- [ ] **Step 2: Run** `pnpm --filter @shop/shared test -- orders` and `pnpm --filter @shop/api test:int -- orders-stats` — FAIL.
- [ ] **Step 3: Implement.** `admin-routes.spec.ts` must stay green.
- [ ] **Step 4: Run** — PASS; codegen leaves `generated.ts` typechecking.
- [ ] **Step 5: Commit** `feat(api): order stats in a reporting currency`

### Task 5: Dashboard — currency selector, new KPIs, chart and currency donut

**Files:**

- Create: `apps/admin/src/components/donut.tsx` (generic) — refactor `status-donut.tsx` onto it
- Create: `apps/admin/src/features/dashboard/components/currency-donut.tsx`
- Create: `apps/admin/src/hooks/use-report-currency.ts`
- Modify: `apps/admin/src/features/dashboard/components/dashboard.tsx` (+ test), `DESIGN.md` (rule 1 example now "Revenue")

**Interfaces:**

- Consumes: regenerated `useGetOrderStatsQuery({range, currency})` (Task 4); `KpiCard` `count` (plan A); `Tabs` rolling indicator.
- Produces:
  - `Donut({segments, label, centre}: {segments: {key: string; value: number; className: string}[]; label: string; centre: ReactNode})` — the sweep-in motion moves here from `StatusDonut`.
  - `CurrencyDonut({byCurrency}: {byCurrency: OrderStats['byCurrency']})` — EUR `stroke-accent`, PLN `stroke-fg` (data colours, not status colours); legend rows "EUR 65% · 13 orders · €1,234.00" (original currency sums); `aria-label` "Paid orders by currency: EUR 13 (65%), PLN 7 (35%)".
  - `useReportCurrency(): [Currency, (c: Currency) => void]` — `localStorage` `admin.reportCurrency`, default `'EUR'`, try/catch.
  - Layout: header row = range Tabs (7d/30d) + currency Tabs (EUR/PLN) labelled "Range" / "Currency". KPI grid `sm:grid-cols-2 xl:grid-cols-5`: Revenue (accent, count-up, delta, spark), Paid orders, Average order, Conversion, LTV (hint `"{buyers} buyers"`). Below: `RevenueChart` (single `DayChart` in the chosen currency) + `StatusCard`; then `CurrencyDonut` card + `TopProducts`; `LatestOrders` unchanged. `awaitingRate > 0` shows a muted note under the KPIs: "{n} orders waiting for an exchange rate — not in the totals yet." Use `currentData` so a currency switch shows the skeleton, not stale numbers.
- [ ] **Step 1: Failing tests** — renders KPIs `Revenue`, `Paid orders`, `Average order`, `Conversion`, `LTV` (regions by name) from a mocked stats body; switching the currency tab requests `currency=PLN` and shows PLN-formatted revenue; no `Revenue EUR`/`Revenue PLN` regions; currency donut `img` has the aria-label above; `averageMinor null` shows `—`; `awaitingRate 2` shows the note; the chosen currency survives a remount (`localStorage`).
- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- dashboard donut` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): dashboard in one reporting currency with a currency split`

### Task 6: E2E and the full gate

**Files:**

- Modify: `e2e/tests/admin.spec.ts` (dashboard test: regions `Revenue`, `Average order`, `LTV`; click `Currency` → `PLN`; Revenue shows `zł`), `e2e/tests/checkout*.spec.ts` only if it asserts dashboard text

- [ ] **Step 1: Update e2e** as above; if the checkout spec ran first, Revenue in PLN equals EUR × 4.30 rounded (fixed adapter).
- [ ] **Step 2: Run** the full gate and a fresh e2e stack (`up -d --build --wait`, run, `down -v`). Expected: green.
- [ ] **Step 3: Commit** `test(e2e): dashboard reporting currency`
