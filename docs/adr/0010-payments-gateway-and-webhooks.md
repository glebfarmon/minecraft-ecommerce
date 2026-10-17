# ADR 0010: Payments gateway seam and webhook idempotency

- Status: Accepted
- Date: 2026-10-17

## Context

Payments use Stripe hosted Checkout (parent spec §9.1). The e2e stack cannot reach Stripe, yet it must exercise the same code that marks an order paid. Stripe delivers webhooks at least once, possibly twice at the same moment, and in any order. Design: `docs/superpowers/specs/2026-10-16-checkout-design.md`.

## Decision

- `PaymentsGateway` (`apps/api/src/payments/`) has two implementations: `StripeGateway` and `FakeGateway`. `PAYMENTS_GATEWAY` selects one.
- `FakeGateway` serves a stand-in payment page at `GET /api/payments/fake/:sessionId`. Its "Pay" button signs a real Stripe-format event with `STRIPE_WEBHOOK_SECRET` and posts it to `POST /api/webhooks/stripe`, so the webhook path (signature check, mapping, status update) is identical in the e2e and in production.
- Webhook handling: the event id goes into a dedupe table (a repeated id is acknowledged and ignored); the order changes status with a conditional update (`WHERE status = 'PENDING'`, plus the late-paid case for `EXPIRED`), so two concurrent events change it once; side effects (the receipt email) run after the transaction commits.
- The amount and currency of a paid event must match the order. A mismatch, or a session we do not know, is logged and acknowledged with 200: Stripe would only retry the same event, so the owner resolves it by hand in the Stripe dashboard.
- Prices are always recomputed from the database when the order is created; the browser sends only `{server, slug, quantity}` lines.

## Consequences

- The fake gateway is refused when `NODE_ENV=production` unless `PAYMENTS_ALLOW_FAKE=true`; only `compose.e2e.yaml` sets it. Its webhook secret in that file is a throwaway.
- A second payment provider means a new gateway class and its own event mapping into the same order transitions.
- A failed receipt is logged and never changes the order status.
