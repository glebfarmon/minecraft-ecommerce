# Refunds, disputes and delivery health (sub-project 5b) — Design

- **Date:** 2026-10-30
- **Parent specs:** `2026-10-01-minecraft-donation-shop-design.md` (§9.3 expiry, refund, dispute; decision 13) and `2026-10-30-delivery-design.md` (5a, which this finishes).
- **Marking:** items tagged _(owner)_ were decided by the owner; items tagged _(my call)_ were chosen by the author and can be overridden.

## 1. Intent

5a made a payment turn into items in the game. 5b makes the reverse safe: the owner can refund an order, a Stripe dispute takes the items back on its own, and a stuck delivery of any kind (including a `REVOKE`) can be seen and resolved from the admin. The dashboard gets the two signals the owner needs for that.

## 2. Goals, non-goals, anti-goals

**Goals**

1. The owner refunds a whole order from the admin, choosing whether the delivered items are taken back _(owner)_.
2. A dispute opened on a payment revokes the items at once, tells the owner, and gives them back if the dispute is won _(owner)_.
3. No refund or dispute leaves the order status lying: the order shows `REFUNDED` / `DISPUTED` only when Stripe says so.
4. A stuck `REVOKE` (and any other stuck delivery) is visible in one place and has the 5a actions Retry / Mark as done.
5. The dashboard shows how many deliveries need attention and the disputes and refunds of the range _(owner chose four cards)_.

**Non-goals**

- Partial refunds _(owner: whole order only)_.
- Refund of case keys and prizes (sub-project 7); `CASE` items have no delivery rows, so nothing is revoked for them.
- New charts. The dashboard already has revenue per day, top products, status donut and currency donut; the owner's "extended" choice is already met by them.
- Customer emails about refunds or disputes (Stripe's own receipt settings cover refunds).

**Anti-goals**

- Items taken back for a refund that Stripe then refused.
- A revoke command sent while a grant command of the same order is still being sent.
- A second refund request, or a second revoke, for the same order.

## 3. Constraints

- Webhook rule from ADR 0010: dedupe by event id, conditional status update, side effects after commit. Order status changes only on a verified Stripe event.
- Money untouched except one Stripe call; amounts stay `amountMinor`. The refund is always the full captured amount.
- Business logic in `apps/api`; admin routes via `@AdminController` + `@RequirePermission`, documented in `apps/api/src/openapi/`, client regenerated with `pnpm --filter @shop/admin codegen`; admin strings in EN and PL with identical keys.
- Payment provider calls go behind `PaymentsGateway`; `FakeGateway` implements them for the e2e.
- Revoke commands come from the product's `revokeCommands` (rendered for the nick like grant commands); a product without any creates no `REVOKE` delivery.
- A new ADR is not needed: this extends ADR 0010 and 0011 without contradicting them.
- TDD; Postgres-touching tests are `*.int-spec.ts`; `pnpm test` stays DB-free.

## 4. Refund flow

1. **Request.** `POST /api/admin/orders/:id/refund` with `{revoke: boolean}`, permission `order.refund` (new; OWNER only by default, assignable to other roles) _(my call)_, audited. Allowed when the order is `PAID` or `DELIVERED`, no refund is already requested, and no delivery of the order is `RUNNING` or `NEEDS_REVIEW` ("resolve the delivery first": a command may still be in flight) _(my call)_. A `FAILED` delivery does not block (parent spec: refund for a failed delivery is allowed).
2. **Stripe call.** The API reserves the request on the order (`refundRequestedAt` and the chosen `revoke` flag, so a double click cannot refund twice and the webhook knows the choice), calls `PaymentsGateway.refund` for the order's payment intent with an idempotency key derived from the order, and releases the reservation if Stripe refuses. The button is unavailable for an order with no payment intent. If the webhook has not arrived 15 minutes after the request (a crash after the Stripe call, or a lost event), the owner may press the button again; the idempotency key makes that safe _(my call)_. The error is shown to the owner; nothing else changed.
3. **After a successful call**, with `revoke` on: deliveries of the order that have not sent anything (`PENDING`, or `FAILED` with no command done) become `CANCELLED` (new status) so nothing new reaches the game _(my call)_. With `revoke` off nothing changes yet.
4. **Webhook `charge.refunded`** (found through the payment intent, which gets a plain index; an event matching no order is logged and acknowledged with 200; an event where the refunded amount is less than the charge, e.g. a partial refund made in the Stripe dashboard, is logged and ignored, since only whole refunds exist) _(my call)_: conditional update `PAID|DELIVERED → REFUNDED`. If the owner asked for revoke, in the same transaction, for every `GRANT` delivery of the order whose commands may have reached the game (`DONE`, `RUNNING`, `NEEDS_REVIEW`, or `FAILED` with commands done), create a `REVOKE` delivery from the product's **current** `revokeCommands` (no snapshot: the owner's latest wording is what should run; a `RUNNING` or `NEEDS_REVIEW` grant gets its revoke queued behind it, the single worker orders them). Grants are shared by orders of the same nick, server and product, so a `TIMED` item takes back only its own share: `expiresAt` is reduced by that item's `durationDays × quantity`; when the result is not in the future the grant gets `revokedAt` and the `REVOKE` delivery is created, otherwise the grant stays and no `REVOKE` is created _(my call)_. Non-`TIMED` items always get their `REVOKE`. After commit enqueue them. Their outcomes follow the 5a table; a `REVOKE` that fails lands in `FAILED` / `NEEDS_REVIEW` and in the owner alert like any other.
5. A refund made directly in the Stripe dashboard arrives as the same webhook with no recorded request; it is treated as `revoke: true` _(my call: the safe default for the owner)_.
6. Not returned on refund: the promo code use (the limit stays spent) _(my call: returning it opens a loop for abuse)_.
7. The public order page shows "order refunded" for `REFUNDED` _(my call)_; the derived delivery field is `none`.

## 5. Dispute flow

_(owner chose variant A: revoke at once, restore on a win)_

1. **`charge.dispute.created`**: `PAID|DELIVERED → DISPUTED`; the same cancel-and-revoke steps as a refund with `revoke: true`; an email to every `OWNER` through `Mailer` (order id, nick, amount, link to the order and to the Stripe dispute); audit entry. Ignored (logged) for an order that is already `REFUNDED` or `DISPUTED`.
2. **`charge.dispute.closed`, outcome won**: `DISPUTED → PAID`, and for every item revoked in step 1 a delivery of the new kind `RESTORE` is created (the product's grant commands again). `RESTORE` runs the `commands` stored on the order's original `GRANT` delivery (exactly what was taken, whatever the catalog says now) _(my call)_. When it is done a `TIMED` grant is renewed by the same rule as a normal grant (5a: `max(current if live, now) + durationDays × quantity`, `revokedAt` cleared), so the player gets the bought time again counted from the restore _(my call, simpler than tracking remaining time)_. The order becomes `DELIVERED` when every `GRANT` and `RESTORE` delivery of its items that is not `CANCELLED` is `DONE`; `REVOKE` rows never affect the order status _(my call)_. A dispute that arrives while a delivery is `RUNNING` or `NEEDS_REVIEW` is handled as in §4.4 (revoke queued behind it); the worker skips a delivery that became `CANCELLED` while its job was already queued (it re-reads the status on pickup).
3. **`charge.dispute.closed`, outcome lost** (or any non-won closing): the order stays `DISPUTED`, the items stay revoked; the owner gets no second email in 5b.
4. The public order page shows "payment under review" for `DISPUTED` _(my call)_.

## 6. Stuck deliveries in one place

A `REVOKE` created for an expired grant belongs to no single order, so the order detail cannot show it. 5b adds an admin page **Deliveries** _(my call)_:

- Lists deliveries that are `FAILED` or `NEEDS_REVIEW`, newest first: kind, nick, server, product, status, attempts, last error, link to the order when there is one.
- Retry and Mark as done work as in 5a (`delivery.resolve`, the same endpoints, the same confirmation that a `NEEDS_REVIEW` command may run twice). Marking a `REVOKE` done does not touch any order status.
- The existing order-detail card keeps working for the order's own deliveries; `REVOKE` and `RESTORE` rows created by a refund or dispute carry the order item and show there too.
- Closes the item deferred in 5a ("stuck REVOKE has no admin UI").

## 7. Dashboard

The stats endpoint (`GET /api/admin/orders/stats`) and the dashboard add two KPI cards beside the existing five _(owner: four-card variant)_:

- **Needs attention:** number of deliveries `FAILED` or `NEEDS_REVIEW`; links to the Deliveries page. Not the accent tone (the revenue card keeps the single accent); a warning dot when above zero.
- **Disputes and refunds:** orders now in `DISPUTED` (a lost dispute stays there; 5b does not tell open from lost, the card says "disputed orders"), and refunds in the range (count and amount in the reporting currency).

Revenue already counts only `PAID` and `DELIVERED`, so a refunded or disputed order leaves it by itself; since the range is by `paidAt`, a refund lowers the revenue of the period the order was paid in _(my call, stated so it does not surprise)_. The status donut already has `REFUNDED` and `DISPUTED` segments.

## 8. Test and local environment

- `FakeGateway` gains a refund call and the fake payment controller can emit `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` events in Stripe's format, signed like the existing ones.
- Integration tests cover each transition and its replay (dedupe), the double-click guard, the Stripe-refuses path and the `RUNNING` block.
- The e2e extends the checkout flow: pay, deliver, refund with revoke on, see the revoke reach the fake RCON server and the order become `REFUNDED`; a dispute created and then won restores the items; a role without `order.refund` gets 403 on a direct call.

## 9. Left to the builder

- Exact Prisma changes (the refund reservation fields, `CANCELLED` and `RESTORE` enum values, the payment-intent index) and their migration.
- How the delivery completion code treats `RESTORE` and `CANCELLED` (§5.2 states the outcome).
- Copy for the new admin strings, order-page states and the dispute email.
- The Deliveries page layout inside the admin design system.

## 10. Open risks

- A refund done in Stripe while a `RUNNING` delivery is in flight can send the grant after the revoke was queued; the worker's single concurrency orders them (grant, then revoke), so the end state is revoked.
- Revoking commands are only as good as the catalog author's `revokeCommands`; a product without them is refunded but keeps its items. The refund dialog tells the owner so.
- A dispute lost after a long time leaves the player's timed grant expired by then; nothing to restore.
