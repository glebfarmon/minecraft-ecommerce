# Checkout and payments (4a)

- Date: 2026-10-16
- Status: Implemented
- Parent: `2026-10-01-minecraft-donation-shop-design.md` §9.1, roadmap row 4. Sub-project 4 is split: **4a** (this spec) orders, Stripe, webhooks, receipt, order status page, admin order view; **4b** promo codes (admin CRUD, reservation at order time, release on expiry).
- Amends the parent: order creation runs Turnstile from 4a on; deliveries, grants and case keys are created by the webhook in sub-projects 5 and 7, not here.

## 1. Goal and success criteria

A player picks products, fills nick and email, pays with a Stripe test card and lands on a page that says the order is paid; a receipt arrives by email; support finds the order in admin.

- Prices and totals are computed only in the API from the database; the client sends product ids and quantities.
- A webhook delivered twice, out of order or concurrently changes the order once.
- The amount Stripe charged equals the order total, or the order does not become `PAID`.
- e2e: cart → checkout → fake payment → `/order/{publicId}` shows paid → receipt in Mailpit → order in admin `/orders`.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int` and e2e are green.

## 2. Decisions

| #   | Topic               | Decision                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Split               | 4a without promo codes; the promo field in the checkout form is hidden until 4b.                                                                                                                                                                                                                                                                                                                       |
| 2   | Payment page        | Stripe Checkout (hosted), as the parent spec decided: line items in the order currency, `metadata.orderId`, customer email, 30 min expiry, automatic payment methods (card, BLIK, P24 where enabled in the Stripe dashboard).                                                                                                                                                                          |
| 3   | Gateway seam        | `PaymentsGateway` interface: `createSession(order) → {sessionId, url}` and `parseWebhook(rawBody, signature) → PaymentEvent`. `StripeGateway` (Stripe SDK) and `FakeGateway` (e2e). Selected by `PAYMENTS_GATEWAY` (`stripe` or `fake`); `fake` with `NODE_ENV=production` refuses to start unless `PAYMENTS_ALLOW_FAKE=true` (the e2e image runs in production mode), the same pattern as the mailer. |
| 4   | Fake gateway        | `FakeGateway.createSession` returns a URL to `GET /api/payments/fake/{sessionId}`: an HTML page with "Pay" and "Cancel". "Pay" signs a `checkout.session.completed` event with `STRIPE_WEBHOOK_SECRET` and posts it to the real webhook handler; then redirects to the success URL. The route exists only when the fake gateway is active.                                                             |
| 5   | Transport           | The browser calls `POST /api/orders` on the shop origin (Traefik routes `shop.<domain>/api/*` to the API): no CORS, the per-IP limit sees the player's address.                                                                                                                                                                                                                                        |
| 6   | Bot protection      | Cloudflare Turnstile on order creation. The API verifies the token with `TURNSTILE_SECRET_KEY` before touching the database. Local and e2e use Cloudflare's documented always-pass test keys.                                                                                                                                                                                                          |
| 7   | Rate limit          | `POST /api/orders` 10 / min per IP (`RATE_LIMIT_ORDER`), parent §7.5.                                                                                                                                                                                                                                                                                                                                  |
| 8   | Public id           | `publicId`: 22 random URL-safe characters (128 bits). The status page is reachable by anyone with the link; it shows nick, items, total, status and a masked email (`p***@gmail.com`).                                                                                                                                                                                                                 |
| 9   | Statuses in 4a      | `PENDING → PAID`, `PENDING → EXPIRED`. The enum already holds `DELIVERED`, `REFUNDED`, `DISPUTED` for sub-project 5. A `completed` event for an `EXPIRED` order (paid in the last second) still sets `PAID`: money was taken.                                                                                                                                                                          |
| 10  | Webhook idempotency | One transaction: insert `processed_webhook_events(stripeEventId)` (conflict → 200, skip) → conditional update of the order (`WHERE status IN (...)`). Mail is sent after commit, and only by the transaction that changed the status.                                                                                                                                                                  |
| 11  | Amount check        | The webhook compares `amount_total` and `currency` with the order. A mismatch leaves the order `PENDING`, logs an error with both values and returns 200 (Stripe must not retry forever).                                                                                                                                                                                                              |
| 12  | Snapshots           | `order_items` copy product name (order locale), server name, `serverId` and `unitAmountMinor`: later catalog edits never change an order.                                                                                                                                                                                                                                                              |
| 13  | Cart clearing       | The cart cookie is cleared when the status page first sees `PAID`, not on redirect: "Back" from Stripe returns to an intact cart.                                                                                                                                                                                                                                                                      |
| 14  | Admin               | Read-only `/orders` list and order page, new permission `order.read` granted to OWNER (all), ADMIN and SUPPORT. Existing roles get it through the automatic permission migration from 3b.                                                                                                                                                                                                              |
| 15  | Not in 4a           | Promo codes (4b); deliveries, `DELIVERED`, refunds, disputes (5); case keys (7); GA4 server-side `purchase` (6).                                                                                                                                                                                                                                                                                       |

## 3. Data

Migration `orders`:

- `Order` — `id`, `publicId` unique, `nick`, `email`, `locale`, `currency`, `subtotalMinor`, `discountMinor` (0 until 4b), `totalMinor`, `status` (`OrderStatus`: `PENDING`, `PAID`, `DELIVERED`, `EXPIRED`, `REFUNDED`, `DISPUTED`), `stripeSessionId` unique nullable (set after the session is created), `deliveryConsentAt`, `paidAt?`, `createdAt`, `updatedAt`.
- `OrderItem` — `id`, `orderId`, `productId`, `serverId`, `quantity` (1–99), `unitAmountMinor`, `productName`, `serverName`.
- `ProcessedWebhookEvent` — `stripeEventId` PK, `type`, `createdAt`.
- Indexes (parent §6.3): `orders(lower(nick))`, `orders(email)`, `orders(status, createdAt)`.
- `Product` deletion (3b: allowed only when unreferenced) now also counts `order_items`.

## 4. API

Contract types in `@shop/shared/orders` (Valibot): `CreateOrderRequest`, `CreateOrderResponse`, `PublicOrder`, `AdminOrderListItem`, `AdminOrder`.

### `POST /api/orders` (anonymous)

Body: `{lines: [{productId, quantity}], currency, locale, nick, email, deliveryConsent: true, termsAccepted: true, turnstileToken}`. 1–50 lines, quantity 1–99, nick `^[A-Za-z0-9_]{3,16}$`.

1. Verify Turnstile → 400 `turnstile_failed`.
2. Load products with prices in `currency`; any line inactive, missing or without a price → 409 `{code: 'unavailable', productIds}`.
3. Transaction: create the order `PENDING` with items; call `gateway.createSession`; store `stripeSessionId`. A gateway failure rolls back → 502 `payments_unavailable`.
4. Respond `{publicId, redirectUrl}`.

### `GET /api/orders/:publicId` (anonymous)

`PublicOrder`: `publicId`, `status`, `nick`, masked email, `currency`, `totalMinor`, items grouped by server, `createdAt`, `paidAt?`. Unknown id → 404.

### `POST /api/webhooks/stripe` (anonymous, raw body)

Signature check (`Stripe-Signature`, `STRIPE_WEBHOOK_SECRET`) → 400 on failure. Handles `checkout.session.completed` (only when `payment_status = 'paid'`), `checkout.session.async_payment_succeeded` (→ `PAID`), `checkout.session.async_payment_failed` and `checkout.session.expired` (→ `EXPIRED` from `PENDING`). Other types → 200, ignored. Excluded from the default throttler.

### Admin (`@AdminController('orders')`, `order.read`)

- `GET /api/admin/orders?q=&status=&cursor=` — 50 per page, newest first; `q` matches nick (case-insensitive prefix), email (exact, case-insensitive) or `publicId`.
- `GET /api/admin/orders/:id` — `AdminOrder`: everything in `PublicOrder` plus full email, `stripeSessionId`, `deliveryConsentAt`, `locale`.

Every route is documented in `apps/api/src/openapi/` (`operationId`, `tags`, `summary`, `description`, responses); `admin-routes.spec.ts` covers the admin ones.

## 5. Web

- `CheckoutForm` submit: Turnstile widget (`@marsidev/react-turnstile` or the plain script, decided in the plan via Context7) → `POST /api/orders` → `window.location.assign(redirectUrl)`.
- Errors: 409 marks the listed lines in the order summary with a "remove unavailable" button; 400 resets the widget with a message; 429 "too many attempts"; 502 / network "payment is temporarily unavailable". All texts in `messages` EN/PL.
- `/[locale]/order/[publicId]`: server render of `GET /api/orders/:publicId` (no cache); while `PENDING`, a client component polls every 2 s up to 60 s, then shows "payment is being processed, a receipt will follow by email". On `PAID` it clears the `cart` cookie once. `EXPIRED` shows "payment was not completed" with a link back to the shop. Unknown id → 404 page.
- Stripe success URL `{PUBLIC_WEB_ORIGIN}/{locale}/order/{publicId}`, cancel URL `{PUBLIC_WEB_ORIGIN}/{locale}` (cart intact).

## 6. Email

`OrderReceipt` React Email template in the order locale: order number, items by server, total, a link to the status page. Sent through the existing `Mailer` after the webhook commit. A send failure is logged; it does not undo `PAID`.

## 7. Admin app

`/orders` table (date, number, nick, email, total, status badge) with search, status filter and "load more"; `/orders/[id]` with items by server, Stripe session id linking to `https://dashboard.stripe.com/test/checkout/sessions/{id}`, consent time. Nav item visible with `order.read`. RTK Query codegen from `openapi.json`.

## 8. Configuration

`.env.example`: `PAYMENTS_GATEWAY`, `PAYMENTS_ALLOW_FAKE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_WEB_ORIGIN`, `RATE_LIMIT_ORDER`. `compose.e2e.yaml`: fake gateway, a throwaway webhook secret, Turnstile test keys. Runbook `docs/runbooks/deploy.md`: create the Stripe test-mode keys, add the webhook endpoint `https://<domain>/api/webhooks/stripe` with the five event types, create the Turnstile widget, paste the values into Dokploy. The owner enters the secrets; they are never sent to the assistant.

## 9. Errors and edge cases

| Case                                                        | Behavior                                      |
| ----------------------------------------------------------- | --------------------------------------------- |
| Product disabled or price removed between cart and order    | 409 with ids; nothing created                 |
| Same webhook event twice / two concurrently                 | One status change, one receipt                |
| `completed` with `payment_status = 'unpaid'` (async method) | Ignored; `async_payment_succeeded` pays later |
| `expired` after `completed`                                 | Ignored (`WHERE status = 'PENDING'`)          |
| Amount or currency mismatch                                 | Order stays `PENDING`, error logged, 200      |
| Webhook for an unknown session                              | 200, warning logged                           |
| Status page polled past 60 s                                | "Processing" message, polling stops           |
| Receipt send fails                                          | Logged; order stays `PAID`                    |

## 10. Testing (TDD)

- Unit: line pricing and totals, email masking, `publicId` generator, webhook event mapping, gateway selection (fake refused in production without the flag), Turnstile verifier (mocked `fetch`), form submit states.
- Integration (Postgres, `*.int-spec.ts`): create order happy path and 409; webhook idempotency including two concurrent identical events; `expired`; late `completed` after `expired`; amount mismatch; admin list search and cursor.
- e2e: the full flow in §1 through the fake gateway; admin `/orders` shows the order to SUPPORT.

## 11. Docs

- ADR 0010 "Payments gateway seam and webhook idempotency".
- `CLAUDE.md`: an orders bullet (module, gateway seam, webhook rule, `order.read`).
- Parent spec roadmap row 4: "split: 4a checkout, 4b promo codes".

## 12. Rulings during planning and execution

Planning:

1. Order lines travel as `{server, slug, quantity}`; prices are never sent by the browser.
2. The Turnstile site key is read at request time (`TURNSTILE_SITE_KEY` on the web service), not baked into the image.
3. Deleting a product that an order references answers 409 `in_use`.

Execution:

4. `REFUNDED` and `DISPUTED` orders show a neutral "order is closed" view on the status page.
5. The status page clears the cart only for the order this browser just paid: the checkout form stores the `publicId` in `localStorage` (`checkout:pending-order`) and the page compares it.
