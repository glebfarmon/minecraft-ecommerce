# Delivery (sub-project 5a) — Design

- **Date:** 2026-10-30
- **Parent spec:** `2026-10-01-minecraft-donation-shop-design.md` (§6.2 tables, §8 queues, §9.2–9.3 worker and expiry). This document narrows sub-project 5 to its first half and records what was decided for it.
- **Marking:** items tagged _(owner)_ were decided by the owner; items tagged _(my call)_ were chosen by the author and can be overridden.

## 1. Intent

Today a paid order stays `PAID` forever: nothing sends the purchased commands to the game server. 5a makes a payment turn into items in the game, shows the player where their order stands, and tells the owner when a delivery fails.

Sub-project 5 is split _(owner)_:

- **5a (this document):** outbox and queue, RCON delivery, retries, `NEEDS_REVIEW`, order status for the player, `TIMED` grants and hourly revoke, failure alert, two admin actions, fake RCON server for tests.
- **5b (separate design later):** refunds and Stripe disputes with revoke deliveries, dashboard KPI cards and delivery-health widgets.

## 2. Goals, non-goals, anti-goals

**Goals**

1. A `PAID` order with non-case items ends `DELIVERED` without human action when the game server is reachable.
2. The player sees the real state of the order on the existing order page, without pressing F5.
3. A delivery that cannot finish never loses the order: Postgres stays the source of truth, a lost Redis loses no paid delivery.
4. The owner learns about stuck deliveries and can resolve each one from the admin.

**Non-goals**

- Refunds, disputes, chargebacks, revoke on refund (5b).
- Dashboard KPI cards for delivery health (5b). 5a only adds the minimum signals in §7.
- Case keys and prize delivery (sub-project 7). `CASE` items get no delivery row in 5a.
- Telegram/Discord alerts _(owner chose email + dashboard)_.
- A live purchase feed (SSE) — sub-project 6.

**Anti-goals** (a failure even if it technically works)

- A command sent twice to the game because a retry was not safe.
- A paid order that sits silently without the player or the owner seeing it.
- Delivery logic inside the webhook request: payment handling must keep returning fast and never fail because of Redis or RCON.

## 3. Constraints

- Business logic only in `apps/api` (ADR 0001, CLAUDE.md); the worker is the same image started with a different entrypoint (parent spec §3.1).
- Webhook rule from ADR 0010 holds: dedupe by event id, conditional status update, **side effects after commit**.
- Money and prices are untouched by this work. Admin routes follow `@AdminController` + `@RequirePermission`, are documented in `apps/api/src/openapi/` and generated into RTK Query (`pnpm --filter @shop/admin codegen`). Admin strings exist in EN and PL with identical keys.
- Command templates may only use the `{nick}` placeholder (already enforced in the catalog admin).
- A new ADR is needed for the queue/outbox decision (BullMQ on the existing Redis, no broker); it must not contradict ADR 0001 or 0010.
- TDD; integration tests for anything that touches Postgres are `*.int-spec.ts`; plain `pnpm test` stays database- and Redis-free.

## 4. Order and delivery flow

1. **Payment transaction** (extends `PaymentEventsService.apply`, same transaction that moves the order to `PAID`): for every non-`CASE` order item create **one `GRANT` delivery row per order item**, with the item's `grantCommands` rendered for the nick and repeated `quantity` times _(my call)_. The delivery's `serverId` is the order item's `serverId`; the nick is the order's `nick`. For `TIMED` items also make sure the player's `grants` row exists (one row per nick, server and product) with no `expiresAt` yet: the clock starts when the `GRANT` delivery becomes `DONE`, see step 5 _(my call: a player never loses paid time to a delayed delivery, and a grant that was never delivered is never revoked)_. The same code runs for a late payment of an `EXPIRED` order (ADR 0010), so those orders are delivered too.
   If the server has no RCON settings or is disabled, the delivery is still created and fails exactly like an unreachable server: nothing was sent, so it retries and ends `FAILED` with the alert _(my call)_.
2. **After commit:** add a BullMQ job per delivery with `jobId = deliveryId`. If Redis is down the payment still succeeds; the sweeper (below) picks the delivery up.
3. **Worker** takes a job, loads the delivery, and sends its commands one by one over RCON using the server's decrypted credentials (`rcon-client`, already a dependency).
4. **Outcomes**, following parent spec §9.2:

| Situation                                                     | Action                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Connect or auth failed, no command sent                       | Retry with backoff 10 s, 1 m, 5 m, 15 m, then 1 h; at most 10 attempts, then `FAILED` |
| A command was sent but no reply arrived (timeout)             | **No automatic retry** (commands may not be idempotent) → `NEEDS_REVIEW`              |
| Connection lost after a command was written, before its reply | `NEEDS_REVIEW`, same as a timeout _(my call)_                                         |
| Connection lost between a reply and the next write            | Counts as a connect failure: retry, resuming after the last replied command           |
| Every command replied                                         | Delivery `DONE`; response log stored. Reply text is not inspected in 5a _(my call)_   |

5. **Order status:** when all deliveries of an order are `DONE`, the order becomes `DELIVERED` (conditional update, idempotent). An order with only `CASE` items has no deliveries in 5a and stays `PAID` until sub-project 7 _(my call)_. When a `GRANT` delivery of a `TIMED` item becomes `DONE`, in the same transaction set the grant's `expiresAt` = max(its current `expiresAt` if not yet revoked, now) + `durationDays` × quantity and clear `revokedAt`. Buying the same product again therefore runs its grant commands again (harmless for ranks) and extends the clock _(my call)_.
6. **Progress inside a delivery:** commands are sent sequentially; the delivery stores how many succeeded, so a retry after a connect failure in the middle resumes after the last replied command and never re-sends one _(my call)_.
7. **Outbox sweeper** (every minute, BullMQ job scheduler): re-enqueues `PENDING` deliveries whose `nextAttemptAt` has passed and that have no live job. This is the only recovery path for lost jobs.
8. **Concurrency:** the worker processes one delivery at a time in 5a, so RCON connections never overlap and a `REVOKE` cannot race a `GRANT` _(my call; revisit with real load)_.
9. **Hourly expiry** (job scheduler): grants with `expiresAt` set, `expiresAt <= now` and no `revokedAt` get `revokedAt` set and a `REVOKE` delivery (the product's `revokeCommands`) created in one transaction, then enqueued. `REVOKE` deliveries follow the same outcome table.

`FAILED` (all attempts used) and `NEEDS_REVIEW` both need a human; the order stays `PAID`.

## 5. Data model

Adds to the Prisma schema; names follow parent spec §6.2.

- `deliveries` — `orderItemId?`, `grantId?`, `serverId`, `kind` (`GRANT` | `REVOKE`), `commands text[]` (rendered at creation, so later catalog edits do not change what is sent), `commandsDone Int`, `status` (`PENDING` | `RUNNING` | `DONE` | `FAILED` | `NEEDS_REVIEW`), `attempts`, `nextAttemptAt`, `lastError?`, `responseLog jsonb`, timestamps. Partial index on `nextAttemptAt` where `status = 'PENDING'` (parent spec §6.3). `alertedAt?` is set when the failure email covered it (§7). `caseKeyId` stays out until sub-project 7.
- `grants` — `nick`, `serverId`, `productId`, `expiresAt?`, `revokedAt?`; unique `(nick, serverId, productId)`; index for the hourly scan on `expiresAt` where `revokedAt` is null.
- A delivery that is `RUNNING` when a worker dies is not recovered by retrying (a command may have been sent): the sweeper moves `RUNNING` rows older than the RCON timeout plus a margin to `NEEDS_REVIEW` _(my call)_.

## 6. What the player sees

On the existing order page (`/order/{publicId}`, polls `GET /api/orders/{publicId}`) _(owner: show the order status)_:

- Statuses shown: paid, being delivered, delivered. A delivery that failed or needs review is shown to the player as "delivery is delayed, we are on it" with no error details _(my call, from the playback the owner approved)_.
- The page polls every few seconds while the order is not `DELIVERED` and stops once it is (or the order is `EXPIRED`) _(my call: 3 s, cap at ~10 minutes of polling, then show a "check back later" line)_.
- The shown state is derived: any delivery `FAILED` or `NEEDS_REVIEW` → "delayed"; else any delivery open → "being delivered"; all `DONE` → delivered. An order with no deliveries (only cases) shows "paid" and does not poll _(my call)_.
- The public order view exposes a derived delivery state, never raw deliveries, errors or RCON data.
- The receipt email stays as it is; no extra "delivered" email in 5a _(my call)_.

## 7. What the owner sees and does

_(owner chose option 1: dashboard + email, with the three actions below; the third is 5b)_

- **Email alert** to every user with the `OWNER` role through the existing `Mailer`. A job runs every 5 minutes, sends one email listing deliveries that are `FAILED` or `NEEDS_REVIEW` with `alertedAt` empty, and sets `alertedAt` in the same transaction; each delivery is announced once, with no reminders in 5a _(my call; simpler than an hourly digest, state lives in Postgres)_. Admin emails are EN only.
- **Admin UI:** the orders list gets a red `StatusDot` for orders with a stuck delivery; the order detail shows each delivery (status, attempts, last error, commands sent, replies). A minimal "needs attention: N" count is shown on the orders page header; full KPI cards are 5b.
- **Actions** on a stuck delivery, guarded by a new permission `delivery.resolve` _(my call: granted to OWNER and ADMIN; OWNER has all anyway)_, audited:
  1. **Retry** — sets the delivery back to `PENDING` with `attempts` reset; `commandsDone` is kept, so replied commands are never re-sent. On `NEEDS_REVIEW` the unreplied command may already have run, so the UI asks for confirmation that it may run twice _(my call)_.
  2. **Mark as done** — the admin delivered it in game; delivery `DONE`, order `DELIVERED` when nothing else is open.
- **Refund** is not part of 5a; the order detail simply has no refund button yet.

## 8. Test and local environment

- A fake RCON server (a small TCP server speaking the RCON protocol) lives in the repo for e2e and integration tests; it can be told to refuse auth, drop the connection, or stay silent, to cover each row of the outcome table. e2e runs against it; no real Minecraft server in CI (parent spec §2, decision 1).
- The queue is behind a thin seam so unit tests can run without Redis; integration tests use the Redis already in the compose setup.
- The e2e checkout test is extended to assert `DELIVERED` on the order page with the fake RCON server, and `NEEDS_REVIEW` text when the server stays silent.

## 9. Left to the builder

- The exact RCON timeout and the "stale `RUNNING`" margin.
- Queue module layout inside `apps/api`, worker entrypoint wiring in the Dockerfile and compose files, BullMQ version.
- Response-log size limits and truncation.
- Exact copy for the order-page states and the alert email, in EN and PL where the surface is public.
- Whether `delivery.resolve` is a new permission string or reuses `order.write`, as long as the owner can limit it separately.

## 10. Open risks

- A reply such as "No player was found" still counts as a reply, so the delivery becomes `DONE`. Commands that need an online player can therefore be "delivered" without effect. Command authors should prefer offline-safe commands (e.g. LuckPerms); reply checking can be added later.
- `quantity > 1` repeats the same commands; for products whose commands are not additive (e.g. "set rank") that is harmless, for additive ones (e.g. "give 1000 coins") it is the intended behaviour. Catalog editors are not warned about this in 5a.
- An RCON timeout always lands in `NEEDS_REVIEW`; on a flaky server this can produce manual work. Tune after seeing real data, not before.
