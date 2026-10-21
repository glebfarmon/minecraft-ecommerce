# Promo Codes (4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player types a code (`ASF14`) in the checkout summary, sees the discount and an animated new total, pays the discounted amount; the receipt and order page show the code; the owner manages codes in admin `/promo-codes`.

**Architecture:** Promo logic lives in the existing `orders` module (`apps/api/src/orders/promo/`): a pure rules file (validity, discount, status), a service shared by `POST /api/promo/validate` and `POST /api/orders`, and an admin CRUD controller. Tables `promo_codes` + two scope join tables; `orders` gets `promoCodeId` + `promoCode` snapshot. The use is reserved by a conditional `UPDATE` as the last statement of the order transaction; the webhook releases it on expiry and re-takes it on late payment. Stripe gets a one-off `amount_off` coupon. Contracts in `@shop/shared/promo`.

**Tech Stack:** NestJS 11, Prisma 7, Stripe Node SDK, Valibot, React Email, Next.js 16 + next-intl, Motion, RTK Query codegen, Jest + Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-promo-codes-design.md` (parent: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md` §7.5, §9.1, §11.5, §13)

## Global Constraints

- Business logic only in `apps/api`; Next.js apps have no route handlers. Global prefix `/api`.
- Money is `amountMinor: Int` + `currency` (`EUR` | `PLN`). Never floats. Prices and discount are always recomputed on the server.
- Do not bump ESLint (9) or TypeScript (6) majors.
- Admin endpoints: `@AdminController(path)` + `@RequirePermission('promo.write')` on **every** route, including reads. Public endpoint: `@AllowAnonymous()`. Every route documented in `apps/api/src/openapi/` (`operationId`, `tags`, `summary`, `description`, response descriptions). After contract changes: `pnpm --filter @shop/api openapi` then `pnpm --filter @shop/admin codegen`.
- Error bodies via `apps/api/src/common/http-errors.ts`; `message` is a stable code.
- Codes: stored upper-case, `^[A-Z0-9]{3,32}$`. Generated codes: 5 letters + 3 digits from `ABCDEFGHJKLMNPQRSTUVWXYZ` / `23456789`.
- Reasons (exact strings): `not_found`, `not_started`, `expired`, `used_up`, `not_applicable`, `wrong_currency`.
- Stripe minimum total: EUR 50, PLN 200 (minor units).
- Rate limit `POST /api/promo/validate`: 20 / min per IP, env `RATE_LIMIT_PROMO`.
- Texts: storefront in `packages/messages/{en,pl}.json`, admin in `apps/admin/messages/{en,pl}.json`, mail in `apps/api/src/mailer/templates.tsx`; EN and PL key sets identical (tests enforce).
- Animations respect `prefers-reduced-motion` (instant change). Motion is already a dependency; add a new dependency only with a stated reason in the commit.
- TDD. Unit tests DB-free; Postgres tests in `apps/api/test/*.int-spec.ts`.
- Gate before every commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm --filter @shop/api test:int` for DB tasks).
- Conventional Commits; trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query "<question>"` before grepping; `graphify update .` after editing code. Use Context7 for Stripe (coupons, `discounts`) and Prisma (partial indexes) APIs.

## Review Focus

1. A code pasted from Discord with spaces, lower case or a stray symbol (`" asf14 "`, `"ASF-14"`) must normalize or read as `not_found`, never a 400 — Task 4 test `normalizes and never 400s on odd input`.
2. A promo failure inside order creation must reach the client as `409 {message: 'promo', issues: {reason}}`, not be swallowed by the existing `catch → badGateway('payments_unavailable')` — Task 5 test `used_up at order time is 409 promo, not 502`.
3. Removing the only eligible item, or switching currency under a `FIXED` code, must drop the code with its reason instead of keeping a stale discount — Task 10 tests `drops the code when the cart no longer qualifies` and `drops a fixed code on currency switch`.
4. Window boundaries: `startsAt == now` is valid, `endsAt == now` is expired — Task 3 test `window boundaries`.
5. Admin lowering `maxUses` below `usedCount`, or touching a locked field of a used code, must be refused with a clear code — Task 8 tests `max_uses_below_used` and `promo_locked`.

---

### Task 1: Contracts and the `promo.write` permission

**Files:**

- Create: `packages/shared/src/promo.ts`, `packages/shared/src/promo.spec.ts`
- Modify: `packages/shared/src/orders.ts`, `packages/shared/src/orders.spec.ts`, `packages/shared/src/access.ts`, `packages/shared/src/access.spec.ts`, `packages/shared/package.json` (export `./promo` like the other entries)

**Interfaces:**

- Produces (`@shop/shared/promo`):
  - `PROMO_CODE_PATTERN = /^[A-Z0-9]{3,32}$/`
  - `PROMO_REASONS` / `PromoReason` (the six strings above); `PROMO_KINDS = ['PERCENT','FIXED']` / `PromoKind`; `PROMO_STATUSES = ['active','scheduled','expired','used_up','disabled']` / `PromoStatus`
  - `PromoCodeSchema`: trims, upper-cases, then `PROMO_CODE_PATTERN` (used by admin input)
  - `LoosePromoCodeSchema`: `string`, trim, upper-case, `maxLength(64)` — no pattern (used by public requests, so odd input becomes `not_found`)
  - `ValidatePromoRequestSchema = {code: LoosePromoCodeSchema, currency, lines: OrderLinesSchema}`
  - `ValidatePromoResponseSchema = variant('ok', [{ok: true, code, subtotalMinor, discountMinor, totalMinor}, {ok: false, reason: PromoReason}])`
  - `AdminPromoCodeSchema = {id, code, kind, value, currency: nullable, maxUses: nullable int, usedCount, startsAt: nullable Iso, endsAt: nullable Iso, isActive, status: PromoStatus, locked: boolean, categoryIds: string[], productIds: string[], version, createdAt}`
  - `PromoCodeInputSchema = {code, kind, value, currency: nullable, maxUses: nullable int ≥ 1, startsAt: nullable Iso, endsAt: nullable Iso, isActive, categoryIds, productIds}` with checks: `PERCENT` → value 1–100 and currency null; `FIXED` → value ≥ 1 and currency set; `endsAt > startsAt` when both set
  - `PromoCodeUpdateSchema = PromoCodeInputSchema + {version}`; `PromoActiveSchema = {isActive, version}`
- Produces (`@shop/shared/orders`): export `OrderLinesSchema` (the existing lines array pipe, extracted); `CreateOrderRequestSchema` gains `promoCode: v.optional(LoosePromoCodeSchema)`; `PublicOrderSchema` gains `subtotalMinor`, `discountMinor`, `promoCode: nullable(string)` (remove the now-duplicate `subtotalMinor`/`discountMinor` from `AdminOrderSchema`).
- Produces (`@shop/shared/access`): `'promo.write'` in `PERMISSIONS` and in `SYSTEM_ROLES.ADMIN`.

- [ ] **Step 1: Write failing tests** in `promo.spec.ts`: `PromoCodeSchema` turns `' asf14 '` into `'ASF14'` and rejects `'AS'`, `'ASF-14'`; `LoosePromoCodeSchema` accepts `'ASF-14'` as `'ASF-14'`; input schema rejects `PERCENT` 0 and 101, `PERCENT` with currency, `FIXED` without currency, `endsAt <= startsAt`. In `orders.spec.ts`: `promoCode` optional; `PublicOrder` requires `discountMinor`. In `access.spec.ts`: ADMIN contains `promo.write`, SUPPORT does not.
- [ ] **Step 2: Run** `pnpm --filter @shop/shared test` — FAIL (module missing).
- [ ] **Step 3: Implement** the schemas above.
- [ ] **Step 4: Run** `pnpm --filter @shop/shared test` — PASS. `pnpm typecheck` will fail in `apps/api` (`toPublicOrder`) — fix by adding the three fields there (`promoCode` column comes in Task 2; until then map `null`).
- [ ] **Step 5: Commit** `feat(shared): promo code contracts and promo.write permission`

### Task 2: Database

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<ts>_promo_codes/migration.sql`, `apps/api/prisma/migrations/<ts>_promo_write_permission/migration.sql`, `apps/api/test/promo-schema.int-spec.ts`

**Interfaces:**

- Produces Prisma models:
  - `PromoCode` (`@@map("promo_codes")`): `id cuid`, `code String`, `kind PromoKind` (enum `PERCENT | FIXED`), `value Int`, `currency Currency?`, `maxUses Int?`, `usedCount Int @default(0)`, `startsAt DateTime?`, `endsAt DateTime?`, `isActive Boolean @default(true)`, `deletedAt DateTime?`, `version Int @default(1)`, timestamps, relations `categories PromoCodeCategory[]`, `products PromoCodeProduct[]`, `orders Order[]`.
  - `PromoCodeCategory` (`promo_code_categories`, PK `[promoCodeId, categoryId]`, cascade on promo, `Restrict` on category) and `PromoCodeProduct` (`promo_code_products`, same shape for products).
  - `Order`: `promoCodeId String?` (relation, `onDelete: Restrict`), `promoCode String?`.
- Unique code among live rows: partial unique index on `promo_codes(code) WHERE "deletedAt" IS NULL`, named `promo_codes_code_live_key`. Use Prisma's native partial-index syntax if Prisma 7 supports it (check Context7); otherwise raw SQL in the migration and a `///` comment on the model saying the index lives in SQL. The service maps P2002 to `conflict('code_taken')`.
- Permission migration: same idempotent `UPDATE "roles"` as `20261017100100_order_read_permission`, adding `promo.write` to `ADMIN`.
- Category/product deletion: a scope link makes the FK refuse; `CategoriesService.remove` / `ProductsService.remove` already map P2003 to `inUse` — verify the product path does too.

- [ ] **Step 1: Write failing int test** `promo-schema.int-spec.ts`: two live rows with `ASF14` → second insert fails; soft-deleted `ASF14` + a new live `ASF14` → both exist; deleting a product linked to a promo → FK error; ADMIN role has `promo.write` after migrations.
- [ ] **Step 2: Run** `pnpm --filter @shop/api test:int -- promo-schema` — FAIL.
- [ ] **Step 3: Edit schema, generate migrations** (`pnpm --filter @shop/api prisma migrate dev --name promo_codes --create-only`, append the index SQL if needed; second migration for the permission). Map `promoCode` in `toPublicOrder` from the column.
- [ ] **Step 4: Run** the int test and `pnpm --filter @shop/api test:int -- orders-schema` — PASS.
- [ ] **Step 5: Commit** `feat(api): promo code tables`

### Task 3: Promo rules (pure)

**Files:**

- Create: `apps/api/src/orders/promo/promo-rules.ts`, `apps/api/src/orders/promo/promo-rules.spec.ts`

**Interfaces:**

- Produces:
  - `STRIPE_MINIMUM: Record<Currency, number> = {EUR: 50, PLN: 200}`
  - `type PromoRow = {kind: PromoKind; value: number; currency: Currency | null; maxUses: number | null; usedCount: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean; deletedAt: Date | null; categoryIds: string[]; productIds: string[]}`
  - `type DiscountLine = {productId: string; categoryId: string; amountMinor: number}` (unit × quantity)
  - `checkAvailable(row: PromoRow | null, now: Date): PromoReason | null` — order: `not_found` (null, deleted or inactive), `not_started` (`now < startsAt`), `expired` (`now >= endsAt`), `used_up` (`maxUses !== null && usedCount >= maxUses`)
  - `computeDiscount(row: PromoRow, lines: DiscountLine[], currency: Currency): {discountMinor: number} | {reason: 'not_applicable' | 'wrong_currency'}` — eligible = lines whose product or category is in scope (both lists empty = all); `FIXED` with other currency → `wrong_currency` (checked first); eligible 0 → `not_applicable`; `PERCENT` → `Math.floor(eligible * value / 100)`; `FIXED` → `min(value, eligible)`; then cap at `subtotal - STRIPE_MINIMUM[currency]`; result ≤ 0 → `not_applicable`
  - `promoStatus(row: PromoRow, now: Date): PromoStatus` — `disabled` if inactive, else `scheduled` / `expired` / `used_up` / `active` by the same checks

- [ ] **Step 1: Write failing tests**: 15% of eligible 1999 → 299; fixed 500 on eligible 300 → 300; fixed EUR on PLN order → `wrong_currency`; category scope picks only that category's lines; product scope; empty scope = all; cap: subtotal 300 EUR, 50% → 150, 90% → 250 (capped), subtotal 50 → `not_applicable`; `window boundaries` (`startsAt == now` ok, `endsAt == now` → `expired`); `used_up` with `usedCount == maxUses`; `maxUses null` never `used_up`; `promoStatus` for each status.
- [ ] **Step 2: Run** `pnpm --filter @shop/api test -- promo-rules` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api): promo code rules`

### Task 4: Public validate endpoint

**Files:**

- Create: `apps/api/src/orders/promo/promo.service.ts`, `apps/api/src/orders/promo/promo.controller.ts`, `apps/api/test/promo-validate.int-spec.ts`
- Modify: `apps/api/src/orders/orders.module.ts`, `apps/api/src/orders/orders.service.ts` (extract product loading), `apps/api/src/throttle/rate-limits.ts` (+ spec), `apps/api/src/throttle/throttle.module.ts`, `apps/api/src/openapi/orders-paths.ts`, `.env.example`

**Interfaces:**

- Consumes: Task 3 rules; `priceLines` from `order-pricing.ts`.
- Produces:
  - `OrdersService.priceRequest(lines, currency, locale): Promise<{items: PricedItem[]; discountLines: DiscountLine[]}>` — the existing product query + `priceLines` (throws `conflict('unavailable', …)` as today), plus `categoryId` per product for `discountLines`. `create` uses it too.
  - `PromoService.evaluate(code: string, lines: DiscountLine[], currency: Currency, now = new Date()): Promise<{ok: true; promo: {id: string; code: string}; discountMinor: number} | {ok: false; reason: PromoReason}>` — loads the live row by `code` (non-matching pattern → `not_found` without a query), runs `checkAvailable` then `computeDiscount`.
  - `POST /api/promo/validate` (`@AllowAnonymous`, `@HttpCode(200)`): body `ValidatePromoRequestSchema`, returns `ValidatePromoResponse`. Unavailable lines → the same 409 `unavailable` as orders.
  - Rate limit `promo: 20` (`RATE_LIMIT_PROMO`), throttler named `promo` on `POST ^/api/promo/validate`.

- [ ] **Step 1: Write failing int test** `promo-validate.int-spec.ts`: valid code → `{ok: true, discountMinor, totalMinor}`; each reason reachable; `normalizes and never 400s on odd input` (`' asf14 '` → ok, `'ASF-14'` → `{ok:false, reason:'not_found'}`, a 65-char code → 400 from the schema); soft-deleted and disabled → `not_found`; validate does not change `usedCount`. Extend `rate-limit.int-spec.ts`: 21st request in a minute → 429.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** service, controller, throttler, OpenAPI path (`operationId: validatePromoCode`, tag `orders`), `.env.example` line.
- [ ] **Step 4: Run** int tests + `pnpm --filter @shop/api test` (openapi spec) — PASS.
- [ ] **Step 5: Commit** `feat(api): validate promo codes`

### Task 5: Orders apply and reserve the code; Stripe coupon

**Files:**

- Modify: `apps/api/src/orders/orders.service.ts`, `apps/api/src/payments/payments-gateway.ts`, `apps/api/src/payments/stripe-gateway.ts` (+ spec), `apps/api/src/payments/fake-gateway.ts` (+ spec), `apps/api/src/payments/fake-payment-page.ts`, `apps/api/src/openapi/orders-paths.ts`
- Test: `apps/api/test/orders-create.int-spec.ts`, `apps/api/test/promo-concurrency.int-spec.ts`

**Interfaces:**

- Consumes: `PromoService.evaluate`, `OrdersService.priceRequest`.
- Produces:
  - `SessionRequest.discount: {minor: number; code: string} | null`.
  - Stripe: when `discount` set, `stripe.coupons.create({amount_off, currency, duration: 'once', max_redemptions: 1, name: code}, {idempotencyKey: \`coupon-${orderId}\`})`then`discounts: [{coupon: id}]` on the session.
  - Fake gateway: stores the discount, the fake page shows a discount row and charges `total − discount`.
  - `create`: when `promoCode` is present, evaluate it; failure → `conflict('promo', {reason})` before the transaction. Order row gets `promoCodeId`, `promoCode`, `discountMinor`, `totalMinor = subtotal − discount`. Last statement inside the transaction, after `createSession` and the session-id update:
    ```sql
    UPDATE promo_codes SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
    WHERE id = $1 AND "deletedAt" IS NULL AND "isActive" AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    ```
    (`updateMany` with the same `where` is fine); 0 rows → throw `conflict('promo', {reason: 'used_up'})`.
  - The `catch` around the transaction rethrows `HttpException`s and only maps other errors to `badGateway('payments_unavailable')`.

- [ ] **Step 1: Write failing tests**: unit — Stripe gateway passes a coupon only when discounted, fake gateway charges the discounted total. Int (`orders-create`) — order with code stores `discountMinor`, `promoCode`, `promoCodeId`, `usedCount` becomes 1; `used_up at order time is 409 promo, not 502`; bad code → 409 `promo` with reason and no order row. Int (`promo-concurrency`) — 20 parallel `POST /api/orders` with a `maxUses: 1` code (fake gateway, Turnstile stub) → exactly one 201, nineteen 409 `promo`, `usedCount == 1`, one order row.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @shop/api test` and `test:int -- orders-create promo-concurrency fake-payment` — PASS.
- [ ] **Step 5: Commit** `feat(api): apply and reserve promo codes on orders`

### Task 6: Webhook releases and re-takes the use

**Files:**

- Modify: `apps/api/src/orders/payment-events.service.ts`
- Test: `apps/api/test/orders-webhook.int-spec.ts`

**Interfaces:**

- `failed` event: when the `PENDING → EXPIRED` update changed a row and `order.promoCodeId` is set, in the same transaction `usedCount − 1` where `usedCount > 0`.
- `paid` event: split the status update into `EXPIRED → PAID` first, then `PENDING → PAID`; when the `EXPIRED → PAID` one changed the row and `promoCodeId` is set, `usedCount + 1` unconditionally (may exceed `maxUses`). Both updates keep the existing fields (`paidAt`, `stripePaymentIntentId`).

- [ ] **Step 1: Write failing int tests**: expiry of a promo order → `usedCount` back to 0; duplicate expiry event → still 0 (dedupe + conditional update); late payment after expiry → `usedCount` 1 even when `maxUses` was reached by another order meanwhile; normal payment → `usedCount` unchanged.
- [ ] **Step 2: Run** `test:int -- orders-webhook` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api): release promo uses of expired orders`

### Task 7: Player sees the discount after paying

**Files:**

- Modify: `apps/api/src/orders/order-view.ts`, `apps/api/src/mailer/templates.tsx` (+ `templates.spec.tsx`), `apps/web/src/features/order/components/order-status.tsx` (+ test), `packages/messages/en.json`, `packages/messages/pl.json`

**Interfaces:**

- Consumes: `PublicOrder.subtotalMinor`, `discountMinor`, `promoCode` (Task 1).
- Receipt and order page: when `discountMinor > 0`, a row between the lines and the total — EN `Promo code {code}` / PL `Kod promocyjny {code}`, amount `−{money}`. No row otherwise.

- [ ] **Step 1: Write failing tests**: template renders `Promo code ASF14` and `−€2.40` for a discounted order and no such row for a plain one (EN and PL); order page the same.
- [ ] **Step 2: Run** api + web tests — FAIL.
- [ ] **Step 3: Implement** (web key `order.promo`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(api,web): show the promo discount on the receipt and order page`

### Task 8: Admin promo API

**Files:**

- Create: `apps/api/src/orders/promo/promo-admin.controller.ts`, `apps/api/src/orders/promo/promo-admin.service.ts`, `apps/api/src/openapi/promo-paths.ts`, `apps/api/test/promo-admin.int-spec.ts`
- Modify: `apps/api/src/orders/orders.module.ts`, `apps/api/src/openapi/openapi.ts`, `apps/api/openapi.json`

**Interfaces:**

- Consumes: `promoStatus` (Task 3); contracts (Task 1); `assertUpdated`, `stale`, `notFound`, `conflict` helpers; `@Audited(action, 'promo_code')` like `categories.controller.ts`.
- Produces routes under `@AdminController('promo-codes')`, all `@RequirePermission('promo.write')`:
  - `GET /` → `AdminPromoCode[]`, live rows only, newest first (`listPromoCodes`)
  - `GET /:id` → `AdminPromoCode` (`getPromoCode`)
  - `POST /` → create (`createPromoCode`), audited `promo.create`
  - `PATCH /:id` → update with `version` (`updatePromoCode`), audited `promo.update`
  - `PATCH /:id/active` → `PromoActiveSchema` (`setPromoCodeActive`), audited `promo.update`
  - `DELETE /:id?version=` → 204 soft delete (`deletePromoCode`), audited `promo.delete`
- `locked = usedCount > 0 || _count.orders > 0`. Update of a locked code changing `code`, `kind`, `value`, `currency`, `categoryIds` or `productIds` → `conflict('promo_locked')`. `maxUses < usedCount` → `conflict('max_uses_below_used')`. Duplicate live code → `conflict('code_taken')`. Unknown category/product id → `badRequest('invalid')`.

- [ ] **Step 1: Write failing int tests**: CRUD round-trip; list hides soft-deleted; `promo_locked` for a used code's value but not for its `endsAt`; `max_uses_below_used`; `code_taken`; stale `version` → 409 `stale`; SUPPORT gets 403; audit rows written.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; OpenAPI paths with `operationId`s above, tag `promo-codes`; regenerate `openapi.json`.
- [ ] **Step 4: Run** `test:int -- promo-admin` and `pnpm --filter @shop/api test` (`admin-routes.spec.ts`) — PASS.
- [ ] **Step 5: Commit** `feat(api): admin promo codes`

### Task 9: Admin promo pages

**Files:**

- Create: `apps/admin/src/app/(shell)/promo-codes/{page,loading}.tsx`, `apps/admin/src/app/(shell)/promo-codes/new/page.tsx`, `apps/admin/src/app/(shell)/promo-codes/[id]/{page,loading}.tsx`, `apps/admin/src/features/promo/components/promo-table.tsx` (+ test), `apps/admin/src/features/promo/components/promo-editor.tsx` (+ test), `apps/admin/src/features/promo/components/code-dice.tsx` (+ test), `apps/admin/src/features/promo/lib/generate-code.ts` (+ test), `apps/admin/src/features/promo/schemas.ts`
- Modify: `apps/admin/src/config/nav.ts`, `apps/admin/messages/en.json`, `apps/admin/messages/pl.json`, `apps/admin/src/lib/api/generated.ts` (codegen), `apps/admin/src/features/orders/components/order-details.tsx` (+ test)

**Interfaces:**

- Consumes: generated hooks `useListPromoCodesQuery`, `useGetPromoCodeQuery`, `useCreatePromoCodeMutation`, `useUpdatePromoCodeMutation`, `useSetPromoCodeActiveMutation`, `useDeletePromoCodeMutation`; catalog hooks for the scope picker; `Card`, `PageHeader`, `DataTable` + `RowMenu`, `FormSection`, `StatusDot`, `EmptyState`, `Skeleton`; date pickers from `@shop/ui` popover/calendar.
- Produces:
  - `generateCode(random: () => number = Math.random): string` — 5 letters + 3 digits from the alphabets in Global Constraints.
  - `<CodeDice onCode={(code) => void} />` — dice button; animates the input's characters split-flap style from `AAAAA000` to the generated code (each slot cycles random characters, slots settle left to right, ~600 ms total); reduced motion → instant.
  - Nav item `{href: '/promo-codes', key: 'promo', icon: TicketPercent, permission: 'promo.write'}`.
  - Table columns and statuses as in the spec; locked fields disabled with the hint; `apiErrors.promo_locked`, `apiErrors.max_uses_below_used`, `apiErrors.code_taken` translated.
  - Order details: show `promoCode` next to the discount.
- UI follows `DESIGN.md` (one accent card per screen, status = dot + label, `ring-accent` focus, no horizontal scroll at 390 px).

- [ ] **Step 1: Write failing tests**: `generateCode` format over 1 000 runs and no `O I 0 1`; dice calls `onCode` with a valid code (reduced motion mocked); table shows `3 / ∞` and status labels; editor disables locked fields and shows the hint; editor sends `currency: null` for percent; messages parity test still passes with new keys.
- [ ] **Step 2: Run** `pnpm --filter @shop/admin test` — FAIL.
- [ ] **Step 3: Implement** (run codegen first).
- [ ] **Step 4: Run** admin tests + typecheck — PASS. Look at the page at 390 px and desktop.
- [ ] **Step 5: Commit** `feat(admin): promo codes pages`

### Task 10: Promo code in the checkout summary

**Files:**

- Create: `apps/web/src/features/checkout/api/validate-promo.ts` (+ test), `apps/web/src/features/checkout/components/promo-field.tsx` (+ test), `apps/web/src/features/checkout/components/animated-money.tsx` (+ test)
- Modify: `apps/web/src/features/checkout/components/order-summary.tsx`, `apps/web/src/features/checkout/components/checkout-form.tsx` (+ test), `apps/web/src/features/checkout/api/create-order.ts` (+ test), `packages/messages/en.json`, `packages/messages/pl.json`

**Interfaces:**

- Consumes: `POST /api/promo/validate`, `CreateOrderRequest.promoCode`, 409 `promo` (Tasks 4–5).
- Produces:
  - `validatePromo(body: ValidatePromoRequest, fetchFn = fetch): Promise<ValidatePromoResponse | {ok: false; reason: 'network' | 'rate_limited'}>`
  - `CreateOrderResult` gains `{ok: false; error: 'promo'; reason: PromoReason}`.
  - `CheckoutForm` state `promo: {code: string; discountMinor: number} | null` plus `promoError: PromoReason | null`; sends `promoCode` on submit; on `error: 'promo'` clears the code and shows the reason.
  - Re-validation: when the cart lines or currency change while a code is applied, call `validatePromo` again; failure clears the code and shows the reason.
  - `<PromoField>` (collapsed link → input + Apply → chip `CODE ×`) and `<AnimatedMoney minor currency />` used for the summary total, the `PayBar` total and the Pay button label; summary gets a discount row.
  - Message keys under `checkout.promo`: `toggle`, `label`, `apply`, `remove`, `discount`, `reasons.{not_found,not_started,expired,used_up,not_applicable,wrong_currency,network,rate_limited}`.
- **Visual design via the `impeccable` skill** (spec: reveal, chip, discount row, number animation; existing web tokens; Motion). `AnimatedMoney` exposes the final value to screen readers through a polite live region and renders the final value instantly under reduced motion.

- [ ] **Step 1: Write failing tests**: `validatePromo` maps 200 ok/not ok, 429, network; `createOrder` maps 409 `promo`; checkout applies a code (discount row, total = subtotal − discount, `promoCode` sent), `drops the code when the cart no longer qualifies`, `drops a fixed code on currency switch`, shows the reason on order-time `used_up`; `AnimatedMoney` renders the final text under reduced motion.
- [ ] **Step 2: Run** `pnpm --filter @shop/web test` — FAIL.
- [ ] **Step 3: Invoke `impeccable`** for the summary design, then implement.
- [ ] **Step 4: Run** web tests + typecheck — PASS. Check the modal at 390 px and desktop, light/dark if applicable.
- [ ] **Step 5: Commit** `feat(web): promo codes at checkout`

### Task 11: End-to-end and docs

**Files:**

- Modify: `e2e/tests/checkout.spec.ts`, `e2e/tests/admin.spec.ts`, `apps/api/src/seed/` (only if e2e needs a seeded code — prefer creating it through the admin in the test), `CLAUDE.md`, this plan (tick boxes)

- [ ] **Step 1: Write e2e**: admin creates `E2E10` (10 %) via the UI using the dice then typing over; player applies `e2e10` at checkout, sees the discount, the fake payment page shows the discounted total, the order page shows `Promo code E2E10`.
- [ ] **Step 2: Run** `pnpm test:e2e` — PASS.
- [ ] **Step 3: Add** one `CLAUDE.md` architecture line: promo codes live in `orders/promo` (`/api/promo/validate`, admin `/api/admin/promo-codes` with `promo.write`); the use is reserved as the last statement of the order transaction and released on expiry; soft delete via `deletedAt`.
- [ ] **Step 4: Run** the full gate + `test:int`.
- [ ] **Step 5: Commit** `test(e2e): promo codes` and `docs: promo codes`
