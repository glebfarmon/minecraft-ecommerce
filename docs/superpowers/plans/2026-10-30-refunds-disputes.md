# Refunds, Disputes and Delivery Health (5b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner refunds a whole order from the admin (optionally taking the items back), a Stripe dispute takes the items back and returns them on a win, stuck `REVOKE`s get an admin page, and the dashboard shows deliveries needing attention plus disputes and refunds.

**Architecture:** Order status changes only on verified Stripe events (`charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`), through new `PaymentEvent` kinds handled by `PaymentEventsService`. A new `delivery-reversal.ts` plans the cancel / `REVOKE` / `RESTORE` deliveries inside the webhook transaction; the 5a worker, sweeper and `complete()` run them. The refund button is `POST /api/admin/orders/:id/refund`, which reserves the request on the order, calls `PaymentsGateway.refund` and waits for the webhook.

**Tech Stack:** NestJS, Prisma 7, Stripe SDK, BullMQ (5a), valibot, Next.js admin (RTK Query generated from `openapi.json`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-30-refunds-disputes-design.md` (read it first; it is the authority). Parent: `2026-10-30-delivery-design.md`.

## Global Constraints

- Order status moves only on a verified Stripe event; webhook rule of ADR 0010: dedupe by event id, conditional status update, side effects (enqueue, mail) after commit.
- Whole-order refunds only; money stays `amountMinor`; no floats.
- New permission `order.refund`: OWNER only (not in `SYSTEM_ROLES.ADMIN`), assignable to other roles. Existing `delivery.resolve` guards Retry / Mark as done.
- Every admin route is documented in `apps/api/src/openapi/` (`operationId`, `tags`, `summary`, `description`, response descriptions) or `admin-routes.spec.ts` fails; regenerate the client with `pnpm --filter @shop/admin codegen`.
- Admin strings in `apps/admin/messages/{en,pl}.json` with identical key sets; API errors are codes translated under `apiErrors.*`; public strings in `packages/messages/{en,pl}.json`.
- Admin UI has no Modal: confirmations are inline bars (see `deliveries-card.tsx`). One accent card per dashboard (revenue keeps it).
- The promo-code use is not returned on refund. `REVOKE` uses the product's current `revokeCommands`; `RESTORE` uses the `commands` stored on the original `GRANT` delivery.
- `RCON_ALLOW_PRIVATE_*` e2e flags never reach production config.
- TDD; Postgres tests are `*.int-spec.ts`; `pnpm test` stays DB-free. Conventional Commits with lowercase subjects (commitlint rejects uppercase words like RCON). Gate before each commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm --filter @shop/api test:int` where Docker runs). Run `graphify query` before grepping and `graphify update .` after code edits.

## Review Focus

Failure modes the spec implies; each has a test in the named task.

1. A replayed or concurrent `charge.refunded` / dispute event must not create a second set of `REVOKE`s or change the order twice (T5).
2. Two orders of one nick and product share one grant: refunding the older order must not strip the newer order's time or rank (T2).
3. A refund request while a delivery is `RUNNING` or `NEEDS_REVIEW` answers 409 with a code, a double click or a Stripe refusal leaves no half state (T6).
4. A `charge.*` event for an unknown payment intent, a partial refund, a dispute on an already refunded order, or a won dispute on an order refunded meanwhile: answered 200 and ignored (T4, T5).
5. Marking a stuck `REVOKE` done never moves any order status; a `CANCELLED` delivery never holds an order off `DELIVERED` nor appears as "delivering" to the buyer (T3, T9).

---

### Task 1: Schema, permission and shared types

**Files:**

- Modify: `apps/api/prisma/schema.prisma`; Create: `apps/api/prisma/migrations/20261030120000_refunds_disputes/migration.sql`
- Modify: `packages/shared/src/access.ts`, `packages/shared/src/delivery.ts`
- Test: `apps/api/test/delivery-schema.int-spec.ts` (extend), `packages/shared/src/access.spec.ts` (extend if present, else the nearest existing access test)

**Interfaces:**

- Produces: `DeliveryKind` gains `RESTORE`; `DeliveryStatus` gains `CANCELLED`; `Order` gains `refundRequestedAt DateTime?`, `refundRevoke Boolean?`, `refundedAt DateTime?` and `@@index([stripePaymentIntentId])`; shared `DELIVERY_STATUSES` includes `'CANCELLED'`, `AdminDeliverySchema.kind` picklist `['GRANT','REVOKE','RESTORE']`; `PERMISSIONS` includes `'order.refund'` (in `SYSTEM_ROLES.OWNER` automatically, absent from ADMIN and SUPPORT).

- [ ] **Step 1: Failing tests.** Int: a `Delivery` can be created with `kind: 'RESTORE'` and `status: 'CANCELLED'`; an `Order` stores `refundRequestedAt`, `refundRevoke`, `refundedAt`. Unit: `SYSTEM_ROLES.OWNER` contains `order.refund`, `SYSTEM_ROLES.ADMIN` does not, `PermissionSchema` accepts it.
- [ ] **Step 2: Run, expect FAIL** (`pnpm --filter @shop/api test:int -- delivery-schema`, `pnpm --filter @shop/shared test`).
- [ ] **Step 3: Implement** the schema change, write the migration by hand in the style of `20261030100000_deliveries` (`ALTER TYPE ... ADD VALUE`, `ALTER TABLE orders ADD COLUMN`, `CREATE INDEX`), regenerate the client (`pnpm --filter @shop/api prisma generate`), update the shared constants. Fix every exhaustive `switch` or `Record<DeliveryStatus, …>` the compiler now flags (`pnpm typecheck`), choosing the neutral behaviour for `CANCELLED` (not stuck, not open) and `RESTORE` (like `GRANT`).
- [ ] **Step 4: Run tests, expect PASS;** run the gate.
- [ ] **Step 5: Commit** `feat(api): schema and permission for refunds and disputes`.

### Task 2: Reversal planner (`delivery-reversal.ts`)

**Files:**

- Create: `apps/api/src/delivery/delivery-reversal.ts`, `apps/api/src/delivery/delivery-reversal.spec.ts` (pure rule), `apps/api/test/delivery-reversal.int-spec.ts`
- Modify: `apps/api/src/delivery/delivery-rules.ts` (add `shrinkGrantExpiry`)

**Interfaces:**

- Produces:
  - `shrinkGrantExpiry(expiresAt: Date, durationDays: number, quantity: number): Date` (pure: `expiresAt − durationDays × quantity` days).
  - `reverseOrderDeliveries(tx: Prisma.TransactionClient, orderId: string, now: Date, opts: {cancelUnsent: boolean}): Promise<string[]>`: returns ids of new `REVOKE` deliveries. With `cancelUnsent`, deliveries of the order that sent nothing (`PENDING`, or `FAILED` with `commandsDone = 0`) become `CANCELLED`. For every `GRANT` delivery whose commands may have reached the game (`DONE`, `RUNNING`, `NEEDS_REVIEW`, `FAILED` with `commandsDone > 0`): a `TIMED` item (delivery has `grantId`) locks the grant row (`FOR UPDATE`, as `complete()` does), sets `expiresAt = shrinkGrantExpiry(...)`; if the result is `<= now` it sets `revokedAt = now` and creates the `REVOKE`, otherwise creates none; a non-`TIMED` item always gets its `REVOKE`. A `REVOKE` is created only when the product has `revokeCommands`; it carries `orderItemId`, `serverId`, `grantId` when any, and `renderCommands(product.revokeCommands, order.nick, 1)`.
  - `restoreOrderDeliveries(tx, orderId): Promise<string[]>`: creates a `RESTORE` delivery (`orderItemId`, `serverId`, `grantId`, `commands` copied from the `GRANT` row) for every `GRANT` delivery of the order whose commands may have reached the game and that the reversal took something from: a non-timed item that has a `REVOKE` row (match by `orderItemId` and `kind = 'REVOKE'`), and every timed item (its grant was shrunk or revoked; completing the `RESTORE` adds the time back). Returns their ids. A non-timed item whose product had no `revokeCommands` gets none (nothing was taken).
- Consumes: `renderCommands`, `grantExpiry` (T1 schema).

- [ ] **Step 1: Failing tests.** Unit: `shrinkGrantExpiry` subtracts exactly `durationDays × quantity` days. Int: (a) `DONE` non-timed GRANT → one `REVOKE` with rendered commands, orderItemId set; (b) product without `revokeCommands` → none; (c) `PENDING` and `FAILED(commandsDone=0)` become `CANCELLED` and get no `REVOKE`, `FAILED(commandsDone=2)` and `NEEDS_REVIEW` get one; (d) Review Focus 2: orders A (7 d) and B (7 d) of one nick/product share a grant with `expiresAt` = start + 14 d; reversing A leaves the grant live with `expiresAt` = start + 7 d and creates no `REVOKE`; reversing B afterwards (expiry now past) sets `revokedAt` and creates the `REVOKE`; (e) `restoreOrderDeliveries` returns one `RESTORE` per reversed item with the original commands even after the product's `grantCommands` were edited.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** as specified. No enqueueing here (callers enqueue after commit).
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(api): plan cancel, revoke and restore deliveries for an order`.

### Task 3: Delivery completion for `RESTORE` and the new order-status rule

**Files:**

- Modify: `apps/api/src/delivery/delivery.service.ts` (`complete`), `apps/api/src/delivery/delivery-rules.ts` (`publicDeliveryState` inputs), `apps/api/src/orders/order-view.ts` (`ORDER_ITEMS_WITH_DELIVERY`, `deliveryStatuses`), `apps/api/src/delivery/delivery-sweeper.service.ts` only if the compiler or tests demand it
- Test: `apps/api/test/delivery-process.int-spec.ts` (extend), `apps/api/src/delivery/delivery-rules.spec.ts` (extend), `apps/api/src/orders/order-view.spec.ts` if present

**Interfaces:**

- Changes: `complete()` treats `RESTORE` like `GRANT` for the grant clock (same `grantExpiry` rule, `revokedAt: null`). Order promotion `PAID → DELIVERED` counts only deliveries of kind `GRANT` or `RESTORE` that are not `CANCELLED`; `REVOKE` rows (now carrying `orderItemId`) never count. `deliveryStatuses(order)` (buyer state) uses the same filter, so it needs `kind` selected. The worker already claims only `PENDING`, so a `CANCELLED` job is a no-op; keep that and test it.

- [ ] **Step 1: Failing tests.** (a) completing a `RESTORE` for a timed product renews the grant (`max(current if live, now) + days × quantity`) and clears `revokedAt`; (b) an order with all `GRANT`s `DONE`, one `CANCELLED` and one `REVOKE` in `FAILED` still promotes to `DELIVERED`; (c) `publicDeliveryState`/`deliveryStatuses` ignore `CANCELLED` and `REVOKE` rows; (d) `DeliveryService.process` on a `CANCELLED` delivery sends nothing and leaves it `CANCELLED`; (e) Review Focus 5: marking a `REVOKE` done on a `REFUNDED` order leaves the order `REFUNDED`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(api): complete restore deliveries and ignore cancelled and revoke rows in order status`.

### Task 4: Gateway refund and Stripe event mapping

**Files:**

- Modify: `apps/api/src/payments/payments-gateway.ts`, `payment-events.ts`, `stripe-gateway.ts`, `fake-gateway.ts`
- Test: `apps/api/src/payments/payment-events.spec.ts` (extend or create), `apps/api/src/payments/fake-gateway.spec.ts` (extend if present)

**Interfaces:**

- `PaymentsGateway.refund(paymentIntentId: string, idempotencyKey: string): Promise<{refundId: string}>`; `StripeGateway.refund` calls `stripe.refunds.create({payment_intent}, {idempotencyKey})`; `FakeGateway.refund` records the call and returns `{refundId: 're_fake_…'}`, repeated key returns the same id.
- `PaymentEvent` gains (all carry `eventId`, `type`):
  - `{kind: 'refunded'; paymentIntentId: string}` from `charge.refunded` only when `charge.amount_refunded === charge.amount` and `charge.payment_intent` is a string; anything else maps to `ignored`.
  - `{kind: 'dispute_opened'; paymentIntentId: string; disputeId: string; amount: number; currency: string}` from `charge.dispute.created` (`dispute.payment_intent` string, else `ignored`).
  - `{kind: 'dispute_closed'; paymentIntentId: string; disputeId: string; won: boolean}` from `charge.dispute.closed` (`won = dispute.status === 'won'`).
- `FakeGateway.signedChargeEvent(kind: 'refunded' | 'dispute_opened' | 'dispute_won' | 'dispute_lost', paymentIntentId: string, amount: number, currency: string): {body: string; signature: string}` builds Stripe-shaped, correctly signed events.

- [ ] **Step 1: Failing tests.** `toPaymentEvent` maps each of the three Stripe event types to the right kind; partial refund, missing payment intent and `dispute.status` other than `won` behave as above; `FakeGateway` events round-trip through `parseWebhook`; repeated refund key returns one id.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Use Context7 (`/stripe/stripe-node`) if a Stripe type is unclear.
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(api): refund call and charge events on the payments gateway`.

### Task 5: Webhook handling of refunds and disputes

**Files:**

- Modify: `apps/api/src/orders/payment-events.service.ts`, `apps/api/src/mailer/templates.tsx` (add `disputeMail`)
- Test: `apps/api/test/orders-refund-webhook.int-spec.ts` (new)

**Interfaces:**

- Consumes: T2 `reverseOrderDeliveries` / `restoreOrderDeliveries`, T4 events.
- `PaymentEventsService.apply` handles the new kinds inside the existing dedupe transaction, looking the order up by `stripePaymentIntentId` (log at warn and return when none or ambiguous):
  - `refunded`: conditional `PAID|DELIVERED → REFUNDED` with `refundedAt = now`; when it matched, `reverseOrderDeliveries(tx, id, now, {cancelUnsent: order.refundRevoke ?? true})` only if `order.refundRevoke ?? true`.
  - `dispute_opened`: conditional `PAID|DELIVERED → DISPUTED`; always `reverseOrderDeliveries(..., {cancelUnsent: true})`; after commit mail every OWNER (reuse the owner-recipient lookup of `DeliveryAlertService`) with `disputeMail(order, dispute)` (order public id, nick, amount, admin order link, Stripe dashboard dispute link) and write an audit-style log line at info.
  - `dispute_closed`: when `won`, conditional `DISPUTED → PAID` and `restoreOrderDeliveries`; when lost, nothing.
  - After commit enqueue all created delivery ids through the existing `enqueueAll`.
- `disputeMail(order, dispute, locale?: never): Mail` English only, like `deliveryAlertMail`.

- [ ] **Step 1: Failing tests** (Postgres; FakeGateway-signed events through `PaymentEventsService`): (a) refund with `refundRevoke = true` → order `REFUNDED`, one `REVOKE` per delivered item, ids enqueued; with `false` → `REFUNDED`, no `REVOKE`; with `null` (refund made in Stripe) → revoked; (b) Review Focus 1: the same event replayed, and two concurrent applications, leave one `REVOKE` set and one status change; (c) Review Focus 4: unknown payment intent → no change, no throw; a refund event for an `EXPIRED` order → ignored; `dispute_opened` on a `REFUNDED` order → ignored (no mail); `dispute_closed(won)` on a `REFUNDED` order → ignored; (d) dispute opened → `DISPUTED`, `REVOKE`s created, owner mail captured by the test mailer (EN, contains public id); dispute won → `PAID` with one `RESTORE` per revoked item, and after those complete the order is `DELIVERED`; dispute lost → stays `DISPUTED`, no `RESTORE`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Keep `apply` readable: one private method per kind.
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(api): apply refund and dispute events with revoke and restore`.

### Task 6: Refund endpoint

**Files:**

- Create: `apps/api/src/orders/orders-refund.service.ts`, `apps/api/test/orders-refund.int-spec.ts`
- Modify: `apps/api/src/orders/orders-admin.controller.ts`, `apps/api/src/orders/orders.module.ts`, `packages/shared/src/orders.ts` (`RefundInputSchema = v.object({revoke: v.boolean()})`, `AdminOrder` gains `refundRequestedAt: Iso|null`), `apps/api/src/orders/order-view.ts` (`toAdminOrder`), `apps/api/src/openapi/orders-paths.ts`, `apps/api/openapi.json`, `apps/admin/messages/{en,pl}.json` (`apiErrors.refund_not_allowed`, `apiErrors.refund_delivery_open`, `apiErrors.refund_already_requested`, `apiErrors.refund_failed`)

**Interfaces:**

- `POST /api/admin/orders/:id/refund` body `{revoke: boolean}`, `@RequirePermission('order.refund')`, `@Audited('order.refund', 'order')` with `req.auditBefore` set, returns `AdminOrder`. `OrdersRefundService.refund(id: string, revoke: boolean, onBefore: (before: AdminOrder) => void): Promise<AdminOrder>`:
  1. 404 unknown order. 409 `refund_not_allowed` unless status is `PAID` or `DELIVERED` and `stripePaymentIntentId` is set.
  2. 409 `refund_delivery_open` if any delivery of the order is `RUNNING` or `NEEDS_REVIEW`.
  3. Reserve with a conditional `updateMany` setting `refundRequestedAt = now`, `refundRevoke = revoke` where `refundRequestedAt` is null or older than 15 minutes (constant `REFUND_RETRY_AFTER_MS` in a `config`-style named const); count 0 → 409 `refund_already_requested`.
  4. `gateway.refund(paymentIntentId, \`refund-${order.id}\`)`; on throw clear `refundRequestedAt`and`refundRevoke`and answer 502-style`refund_failed`(use the project's`http-errors` helper that fits; add one if none).
  5. On success with `revoke`, set the order's unsent deliveries (`PENDING`, or `FAILED` with `commandsDone = 0`) to `CANCELLED`. Order status is not touched (webhook does that).
- OpenAPI entry documents the four 409/4xx codes.

- [ ] **Step 1: Failing tests.** (a) `PAID` order, `revoke: true`: gateway called once with the key, reservation stored, unsent deliveries `CANCELLED`, status unchanged; (b) `revoke: false` cancels nothing; (c) Review Focus 3: `RUNNING` and `NEEDS_REVIEW` → 409 `refund_delivery_open`, nothing reserved; two parallel requests → one gateway call; second after 15 min → allowed, same key; (d) gateway throws → reservation cleared, nothing cancelled, error code returned; (e) `PENDING`/`EXPIRED`/`REFUNDED`/no payment intent → 409 `refund_not_allowed`; (f) a role without `order.refund` gets 403 and an audit row exists for a success.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement;** add the permission label wherever roles list permissions in the admin (search `delivery.resolve` in `apps/admin` and add `order.refund` beside it, EN and PL).
- [ ] **Step 4: Run tests, expect PASS;** `pnpm --filter @shop/api openapi` (the repo's script that rewrites `openapi.json`; use the one `apps/api/package.json` defines), gate.
- [ ] **Step 5: Commit** `feat(api): admin refund endpoint with optional revoke`.

### Task 7: Fake-gateway event hooks for the e2e

**Files:**

- Modify: `apps/api/src/payments/fake-payment.controller.ts`
- Test: `apps/api/test/fake-payment.int-spec.ts` (extend)

**Interfaces:**

- e2e only (404 unless `FakeGateway` is active): `POST /api/payments/fake/orders/:publicId/events/:kind` with `kind` in `refunded | dispute_opened | dispute_won | dispute_lost`; loads the order's `stripePaymentIntentId`, `totalMinor`, `currency`, builds `FakeGateway.signedChargeEvent`, applies it through `PaymentEventsService.apply(gateway.parseWebhook(...))`, answers `{received: true}`. 404 for an unknown order, 400 for an unknown kind.

- [ ] **Step 1: Failing tests:** each kind reaches the order (status changes as T5 says); 404 with the Stripe gateway.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; gate.**
- [ ] **Step 5: Commit** `feat(api): fake gateway hooks for refund and dispute events`.

### Task 8: Admin refund UI and buyer-facing states

**Files:**

- Modify: `apps/admin/src/features/orders/components/order-details.tsx` (+ new `refund-bar.tsx` beside it, test `refund-bar.test.tsx`), `apps/admin/messages/{en,pl}.json` (`orders.refund.*`), `apps/admin/src/lib/api/generated.ts` (codegen), `apps/web/src/features/order/components/order-status.tsx` (+ its test), `packages/messages/{en,pl}.json` (`order.refunded.title/body`, `order.review.title/body`)
- Consumes: T6 endpoint, generated `useRefundOrderMutation` (check the generated name after codegen).

**Interfaces:**

- Admin order detail, for users with `order.refund` and an order `PAID|DELIVERED` with no live reservation: a "Refund" button opens an inline confirm bar with a checkbox "Take the delivered items back" (checked by default), a line "Products without revoke commands keep their items", Confirm / Cancel; Confirm calls the mutation and invalidates the order tag. When `refundRequestedAt` is set and status is not yet `REFUNDED`: show "Refund requested, waiting for Stripe" and, after 15 minutes, the button again. `REFUNDED` and `DISPUTED` show a plain status line. Errors show `apiErrors.*` texts.
- Buyer page: `REFUNDED` renders "This order was refunded", `DISPUTED` renders "This payment is under review"; neither polls.

- [ ] **Step 1: Failing tests** (Vitest): bar hidden without permission and for ineligible statuses; default checkbox on; confirm posts `{revoke: true}`; unchecked posts `{revoke: false}`; waiting line when requested; web page shows the two new states and does not start polling for them.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement;** run `pnpm --filter @shop/admin codegen` first; keep EN and PL keys identical (the key-parity test enforces it).
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(admin,web): refund control and refunded or disputed order states`.

### Task 9: Deliveries page (stuck deliveries in one place)

**Files:**

- Modify: `apps/api/src/delivery/deliveries-admin.controller.ts`, `deliveries-admin.service.ts`, `delivery-view.ts`, `packages/shared/src/delivery.ts` (`AdminDeliveryListItemSchema`, `AdminDeliveryPageSchema`), `apps/api/src/openapi/deliveries-paths.ts`, `apps/api/openapi.json`, `apps/admin/src/app/(shell)/_components/nav.tsx` (+ `nav.test.tsx`), `apps/admin/messages/{en,pl}.json`
- Create: `apps/admin/src/app/(shell)/deliveries/page.tsx`, `loading.tsx`, `apps/admin/src/features/deliveries/components/deliveries-table.tsx` (+ test)
- Test: `apps/api/test/deliveries-admin.int-spec.ts` (extend)

**Interfaces:**

- `GET /api/admin/deliveries` (`order.read`): the deliveries `FAILED` or `NEEDS_REVIEW`, newest first, cursor-paged like the orders list (page 50). Item: the `AdminDelivery` fields plus `nick: string`, `orderId: string | null`, `orderPublicId: string | null`, `productName: string | null` (item snapshot, or the grant's product name for an expiry `REVOKE`), `kind` including `RESTORE`. `nick` comes from the order, or from the grant for an expiry `REVOKE`.
- Page `/deliveries`: `DataTable` with kind, nick, server, product, status dot, attempts, last error, order link; Retry and Mark as done reuse the existing mutations and the NEEDS_REVIEW "may run twice" confirmation of `deliveries-card.tsx` (extract the confirm bar into a shared component rather than copying it) and are shown only with `delivery.resolve`. Nav gets a "Deliveries" entry (needs `order.read`) showing the attention count when above zero.
- `GET` stays read-only; Retry / Mark as done endpoints are unchanged.

- [ ] **Step 1: Failing tests.** API: list returns an expiry `REVOKE` (no order) and a refund `REVOKE` (with order link), excludes `DONE`/`PENDING`/`CANCELLED`, pages with a cursor, requires `order.read`. Admin: table renders rows and the empty state; actions hidden without `delivery.resolve`; retry on a `NEEDS_REVIEW` row asks for confirmation first; nav shows the badge.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement;** codegen; EN/PL parity.
- [ ] **Step 4: Run tests, expect PASS;** gate.
- [ ] **Step 5: Commit** `feat(admin,api): deliveries page for stuck deliveries of every kind`.

### Task 10: Dashboard cards

**Files:**

- Modify: `packages/shared/src/orders.ts` (`OrderStatsSchema` gains `attentionCount`, `disputedCount`, `refundedCount`, `refundedMinor`), `apps/api/src/orders/orders-stats.service.ts`, `apps/admin/src/features/dashboard/components/dashboard.tsx` (+ `dashboard.test.tsx`), `apps/admin/messages/{en,pl}.json` (`dashboard.attention`, `dashboard.disputesRefunds`, hints), `apps/api/openapi.json`, generated client
- Test: `apps/api/test/orders-stats.int-spec.ts` (extend)

**Interfaces:**

- `attentionCount`: deliveries `FAILED` or `NEEDS_REVIEW` now (not range-bound). `disputedCount`: orders in `DISPUTED` now. `refundedCount`: orders with `refundedAt` in the range. `refundedMinor`: their sum in the reporting currency (`totalEurMinor` / `totalPlnMinor` as for revenue; orders without a rate are skipped from the sum only).
- Dashboard: two `KpiCard`s beside the existing five, neither accent: "Needs attention" (value `attentionCount`, warning `ToneDot` when above zero, links to `/deliveries`) and "Disputes and refunds" (value `disputedCount` with label "disputed orders", hint "refunds in range: N, amount"); skeleton `Loading` gets matching placeholders; grid still has no horizontal scroll at 390 px.

- [ ] **Step 1: Failing tests.** Int: counts and the refunded sum for a seeded mix (stuck `REVOKE` counts; `CANCELLED` does not; a refund outside the range is excluded). Component: cards render the figures, the attention card links to `/deliveries`, warning dot only when above zero.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; gate.**
- [ ] **Step 5: Commit** `feat(admin,api): dashboard cards for deliveries needing attention, disputes and refunds`.

### Task 11: e2e, docs and operations notes

**Files:**

- Modify: `e2e/tests/delivery.spec.ts` or create `e2e/tests/refund.spec.ts`, `e2e/support/checkout.ts` if a helper is needed; `docs/guides/deploy-from-scratch.md` (Stripe webhook step), `docs/runbooks/deploy.md`, `CLAUDE.md` (one bullet), `README.md` (feature list line); tick this plan's checkboxes.

- [ ] **Step 1: Write the e2e** (follow `delivery.spec.ts`): (a) buyer pays, order `DELIVERED`; owner opens the order, refunds with "take back" on, the test then posts `POST /api/payments/fake/orders/:publicId/events/refunded`; the order page shows "refunded", the admin detail shows a `REVOKE` delivery reaching `DONE` (worker runs against the fake RCON); (b) pay, `dispute_opened` event → buyer page "under review", owner mail in Mailpit; `dispute_won` → items restored (a `RESTORE` delivery `DONE`), order `DELIVERED`; (c) a `SUPPORT`-style session (or a direct API call without `order.refund`) gets 403 on the refund endpoint; (d) a silent-server `NEEDS_REVIEW` delivery blocks the refund with the "resolve the delivery first" message and appears on the Deliveries page where Mark as done clears it.
- [ ] **Step 2: Run** `pnpm test:e2e -- refund` against `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait`; fix flakiness by waiting on UI state, not sleeping.
- [ ] **Step 3: Docs.** In `deploy-from-scratch.md` add that the Stripe webhook endpoint must also listen to `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` (Stripe dashboard → Developers → Webhooks → the endpoint → Update events), and that the refund button needs the new `order.refund` permission (OWNER has it). `CLAUDE.md`: one bullet on refunds and disputes (events, `order.refund`, reversal rules, fake hooks e2e-only). `README.md`: one line.
- [ ] **Step 4: Gate** (`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`, then `pnpm --filter @shop/api test:int`), `graphify update .`.
- [ ] **Step 5: Commit** `docs: refunds, disputes and the stripe events to subscribe to` (and the e2e in its own `test(e2e): …` commit first).
