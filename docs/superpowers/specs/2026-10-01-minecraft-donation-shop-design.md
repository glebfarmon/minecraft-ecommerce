# Minecraft Donation Shop — Design Spec

- **Date:** 2026-10-01
- **Status:** Draft for review
- **Scope:** Whole system architecture + roadmap of sub-projects. Each sub-project gets its own implementation plan.
- **Out of scope for this spec:** visual design (colors, typography, page layouts). Done as a separate track from the owner's references; this spec defines _what_ each page does, not how it looks.

---

## 1. Purpose and success criteria

### Purpose

A public GitHub portfolio project that demonstrates full-stack skills, DevOps, and disciplined work with AI. It is a donation shop for Minecraft servers: players buy ranks, currency, kits and case keys; purchases are delivered to game servers over RCON; cases and scratch cards are opened on the site with provably fair outcomes.

### Success criteria

1. A live demo URL works end to end in Stripe test mode: pick server → cart → pay with test card → commands arrive on the configured RCON server.
2. Case opening is verifiable: any opening can be recomputed on `/fairness` in the browser with the same shared code.
3. CI is green on `main` with unit, integration, contract, e2e, Lighthouse, secret scanning and CodeQL.
4. Daily encrypted backups exist and a weekly CI job proves they restore.
5. The repository shows the AI workflow: `CLAUDE.md`, specs and plans in `docs/superpowers/`, ADRs, and a README section on how AI was used (including where it was wrong).

### Constraints

- Budget: free tooling wherever possible. Paid: one Hetzner VPS (CX22 or current equivalent, ~€5/mo) and a domain.
- Timeline: ~3–4 weeks full-time as a target, not a hard deadline. Everything below is in scope.
- No own Minecraft server. RCON delivery is verified manually against a free Minecraft host; automated tests use a fake RCON server.
- Servers may run in offline mode (non-premium). Player identity is the nickname.

### Non-goals

- Player accounts / player cabinet.
- Real payments (Stripe test mode only).
- Top-donators leaderboard, time-limited sales, gifting UI, sales charts in admin (GA4 covers it), in-product AI features, staging/preview environments, load testing, microservices.

---

## 2. Decisions log

| #   | Topic               | Decision                                                                                                                                                                                             |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Game side           | No own MC server. RCON target configured per server in admin. Fake RCON server for CI/e2e.                                                                                                           |
| 2   | Product kinds       | `PERMANENT`, `TIMED` (N days, auto-revoked), `CASE`. Currency and kits are `PERMANENT` products that just run different commands.                                                                    |
| 3   | Player identity     | Nickname `^[A-Za-z0-9_]{3,16}$` + email. Confirmation step before payment. No Mojang API.                                                                                                            |
| 4   | Case opening        | Via emailed link `/open/{token}`; player opens keys on the site when they want.                                                                                                                      |
| 5   | Fairness            | Published odds + provably fair (HMAC-SHA256, server seed commit, client seed, nonce).                                                                                                                |
| 6   | Languages           | Storefront EN (default) + PL. Admin EN only.                                                                                                                                                         |
| 7   | Currency            | EUR + PLN, separate price per currency, stored as integer minor units.                                                                                                                               |
| 8   | Admin access        | Permissions fixed in code; roles in DB (seeded `OWNER`, `ADMIN`, `SUPPORT`); `OWNER` edits role permissions, creates roles, assigns them; `OWNER` always has all permissions. Audit log.             |
| 9   | Delivery failures   | Outbox + queue with retries; `FAILED` → alert + manual retry.                                                                                                                                        |
| 10  | Infra               | Buy Hetzner VPS + domain; Cloudflare in front; Dokploy on the VPS.                                                                                                                                   |
| 12  | Servers & catalog   | Multiple game servers. Admin-managed categories. A product is offered per server with its own commands and prices. Cart may mix servers.                                                             |
| 13  | Refunds             | Mandatory "immediate delivery" consent. Refund only for `FAILED` delivery or admin decision; whole order only; orders with an opened case are not refundable. Refund/chargeback run revoke commands. |
| 14  | Email               | Resend + React Email, one sending subdomain `mail.<domain>`, behind a `Mailer` interface. Mailpit locally/CI.                                                                                        |
| 15  | Admin login         | Better Auth: email OTP + Google; Apple implemented but disabled until keys exist. Invite-only. TOTP 2FA mandatory.                                                                                   |
| 16  | Consent & analytics | Own cookie banner (necessary / analytics), GA4 with Consent Mode v2, server-side `purchase` via Measurement Protocol only with consent.                                                              |
| 17  | Extra shop features | Promo codes; live purchase feed (SSE).                                                                                                                                                               |
| 18  | Admin dashboard     | KPI cards, delivery health, case stats (declared vs actual odds).                                                                                                                                    |
| 19  | Timeline            | ~3–4 weeks full-time as a target.                                                                                                                                                                    |
| 20  | Release             | Build everything, ship as sub-project PRs.                                                                                                                                                           |
| 21  | AI showcase         | `CLAUDE.md` + specs/plans + ADRs + README section.                                                                                                                                                   |
| —   | Architecture        | Modular monolith (NestJS `api` + `worker` from one image) + two Next.js apps (`web`, `admin`) in a Turborepo monorepo.                                                                               |
| —   | Object storage      | Cloudflare R2 (free tier) instead of Hetzner Object Storage.                                                                                                                                         |
| —   | Timed expiry        | Checked hourly; repeat purchase extends `expiresAt`.                                                                                                                                                 |
| —   | Age gate            | 18+ modal before first case/scratch opening; stored in a necessary cookie; 18+ badge on cases.                                                                                                       |

---

## 3. Architecture

### 3.1 Topology

```
Player/Admin ──► Cloudflare edge (DNS proxy, DDoS, WAF, Turnstile, TLS)
                    │  only Cloudflare IPs allowed through Hetzner firewall
                    ▼
               Hetzner VPS ── Traefik (bundled with Dokploy)
                    ├─ <domain>/api/*        → api      (NestJS HTTP)
                    ├─ <domain>/*            → web      (Next.js storefront)
                    ├─ admin.<domain>/api/*  → api
                    ├─ admin.<domain>/*      → admin    (Next.js admin)
                    ├─ api.<domain>          → api      (Stripe webhooks, Swagger only)
                    ├─ worker   (no inbound traffic: BullMQ consumers, schedulers)
                    ├─ backup   (supercronic, daily pg_dump → R2)
                    ├─ postgres
                    └─ redis
               Cloudflare R2: media bucket (cdn.<domain>), backups bucket (private)
```

- Same-origin API: Traefik routes `/api/*` by path before Next.js. No CORS, host-only cookies. Next.js contains **no route handlers / business logic**.
- SSR in Next.js calls NestJS over the internal Docker network (`http://api:4000`), forwarding the user's cookies.
- Local dev runs the same Traefik rules in `docker compose`.

### 3.2 Monorepo layout

```
apps/
  web/      Next.js 16 storefront (EN/PL)
  admin/    Next.js 16 admin (EN)
  api/      NestJS; entrypoints main.ts (HTTP) and worker.ts (queues, schedulers)
packages/
  shared/   valibot schemas, types, money utils, provably fair algorithm
  ui/       shadcn components shared by web and admin
  email/    React Email templates
  config/   ESLint, tsconfig, Prettier presets
docs/
  superpowers/specs/, superpowers/plans/, adr/
infra/
  docker/, traefik/, backup/
```

### 3.3 Backend modules (NestJS)

| Module     | Owns                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| `catalog`  | servers, categories, products, offerings, prices, translations; Redis cache |
| `orders`   | cart pricing, promo codes, order lifecycle, public order status             |
| `payments` | `PaymentsGateway` interface; Stripe implementation; webhooks                |
| `delivery` | outbox, RCON client, retries, grants, expiry scheduler, revoke flow         |
| `cases`    | case definitions, keys, provably fair opening, scratch grid                 |
| `auth`     | Better Auth integration, sessions, invites, 2FA                             |
| `admin`    | roles/permissions, audit log, dashboard queries, uploads (R2)               |
| `feed`     | Redis pub/sub → SSE live purchase feed                                      |
| `mail`     | `Mailer` interface, Resend implementation                                   |
| `health`   | `@nestjs/terminus` checks (Postgres, Redis)                                 |

Module boundaries are enforced by importing only a module's public service, never its repositories. ADR documents when a module (e.g. `delivery`) would be extracted into a service and why a broker would then be added.

---

## 4. Infrastructure, deploy, Cloudflare

### 4.1 Server

- Hetzner Cloud firewall: 80/443 from Cloudflare IP ranges only; SSH from owner IP only. Dokploy UI served only at `deploy.<domain>` behind Cloudflare Access (owner email + a service token used by GitHub Actions); port 3000 closed in the firewall.
- TLS: Cloudflare Full (strict) with a Cloudflare Origin Certificate on the server.
- CX22 (4 GB) runs the full stack; upgrade to CX32 if memory pressure appears.

### 4.2 DDoS and abuse protection

- Proxied DNS makes the domain resolve to Cloudflare anycast IPs. L3/L4 and L7 (HTTP DDoS managed ruleset) mitigation is automatic and unmetered for **all** traffic on proxied hostnames — not configured per path.
- The origin IP must stay hidden: firewall allows only Cloudflare; email is sent via Resend so headers do not reveal the VPS.
- Per-path controls (abuse, not DDoS):

| Path                                            | Control                                                       |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `/api/auth/*`                                   | Strict app rate limits + Turnstile                            |
| `/api/orders` (checkout), `/api/promo/validate` | IP rate limits; Turnstile on checkout (anti card-testing)     |
| `/api/open/*`                                   | Rate limit per token                                          |
| `/api/webhooks/stripe`                          | Excluded from challenges; protected by signature verification |
| `admin.<domain>`                                | WAF rule; optional Cloudflare Access as a second gate         |

- Free plan has 1 rate-limit rule and 5 WAF custom rules, so primary rate limiting lives in the app (§7.5). Client IP comes from `CF-Connecting-IP`, trusted because only Cloudflare can reach the origin.

### 4.3 CI/CD

1. PR: GitHub Actions — lint, typecheck, unit, integration, contract checks, e2e (2 shards), Lighthouse, gitleaks, CodeQL, build.
2. Merge to `main`: build images, push to GHCR.
3. Actions calls the Dokploy deploy webhook; Dokploy pulls the new tag.
4. A one-off `prisma migrate deploy` container runs before `api`/`worker` start; failure aborts the deploy and the old version keeps running.

- Single environment (prod). Dependabot weekly.

---

## 5. Code quality and API contract

- pnpm workspaces + Turborepo (cached, affected-only tasks). Node 24 LTS; pnpm pinned via `packageManager`.
- TypeScript `strict` + `noUncheckedIndexedAccess`.
- ESLint flat config with `typescript-eslint` strict; Prettier with `@trivago/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss` (Tailwind plugin loaded last).
- Husky + lint-staged (Prettier + ESLint on staged files); commitlint with Conventional Commits.
- **Contract flow:**
  1. valibot schemas in `packages/shared` define request/response shapes.
  2. NestJS validates with a custom `ValibotPipe` (no class-validator).
  3. Swagger/OpenAPI generated from the same schemas via `@valibot/to-json-schema`; served at `api.<domain>/docs`.
  4. `openapi.json` is committed; `@rtk-query/codegen-openapi` generates typed RTK Query hooks for `web` and `admin`.
  5. CI regenerates `openapi.json` and fails on diff.

---

## 6. Data model

### 6.1 Conventions

- Money: `amountMinor: Int` + `currency` (`EUR` | `PLN`). Formatting via `Intl.NumberFormat`; discounts via a single `applyDiscount()` in `shared` with explicit rounding.
- Translations: separate `*_translations` tables with PK `(entityId, locale)`; `enum Locale { en, pl }`; read with fallback to `en`.
- IDs: `cuid2`/UUID primary keys; public order reference `publicId` is unguessable.
- All foreign keys used in joins get an explicit `@@index`.

### 6.2 Tables

**Catalog**

- `servers` — name, slug, `rconHost`, `rconPort`, `rconPasswordEnc` (AES-256-GCM, key from env), `isActive`, sort.
- `categories` — slug, sort. `category_translations` — name.
- `products` — `categoryId`, slug, `kind` (`PERMANENT` | `TIMED` | `CASE`), `durationDays?`, `caseId?`, `imageKey?`, `isActive`. `product_translations` — name, description.
- `product_offerings` — `productId`, `serverId`, `grantCommands text[]`, `revokeCommands text[]`; unique `(productId, serverId)`.
- `prices` — `offeringId`, `currency`, `amountMinor`; unique `(offeringId, currency)`.

**Orders**

- `orders` — `publicId`, nick, email, currency, `subtotalMinor`, `discountMinor`, `totalMinor`, `status` (`PENDING` | `PAID` | `DELIVERED` | `EXPIRED` | `REFUNDED` | `DISPUTED`), `stripeSessionId` unique, `promoCodeId?`, `deliveryConsentAt`, `gaClientId?` (set only with analytics consent, used for Measurement Protocol), timestamps.
- `order_items` — `orderId`, `offeringId`, quantity, `unitAmountMinor`, snapshot of product name and server name.
- `deliveries` — `orderItemId?`, `grantId?`, `caseKeyId?` (prize delivery), `serverId`, `kind` (`GRANT` | `REVOKE`), rendered commands, `status` (`PENDING` | `RUNNING` | `DONE` | `FAILED` | `NEEDS_REVIEW`), `attempts`, `nextAttemptAt`, `lastError`, response log.
- `grants` — nick, `serverId`, `offeringId`, `expiresAt`, `revokedAt?` (for `TIMED`).
- `processed_webhook_events` — `stripeEventId` PK.
- `promo_codes` — code (case-insensitive unique), `kind` (`PERCENT` | `FIXED`), value, `currency?` for fixed, `maxUses`, `usedCount`, `startsAt`, `endsAt`, scope (categories/products).

**Cases**

- `cases` — `kind` (`ROULETTE` | `SCRATCH`). `case_translations` — name, description.
- `case_prizes` — `caseId`, `productId`, `weight Int`.
- `case_seeds` — per order: `orderId` unique, `serverSeed`, `serverSeedHash`, `revealedAt?`.
- `case_keys` — `orderItemId`, `caseId`, `serverId`, `tokenHash` unique, `prizeTableSnapshot jsonb`, `nonce`, `clientSeed?`, `prizeProductId?`, `openedAt?`, `voidedAt?`.

**Admin**

- Better Auth tables: `user`, `session`, `account`, `verification`, `twoFactor`.
- `roles` — name, `permissions text[]`, `isSystem`. `user.roleId`.
- `invites` — email, `roleId`, `tokenHash`, `expiresAt`, `acceptedAt?`.
- `audit_logs` — `actorId`, action, `entityType`, `entityId`, `before jsonb`, `after jsonb`, ip, `createdAt`.

### 6.3 Indexes (driven by queries)

| Query                                 | Index                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| Worker picks due deliveries / sweeper | partial `deliveries(nextAttemptAt) WHERE status = 'PENDING'`   |
| Hourly expiry job                     | partial `grants(expiresAt) WHERE revokedAt IS NULL`            |
| Support search                        | `orders(lower(nick))`, `orders(email)`                         |
| Dashboard KPIs                        | `orders(status, createdAt)`                                    |
| Case stats                            | `case_keys(caseId, prizeProductId) WHERE openedAt IS NOT NULL` |
| Audit by entity                       | `audit_logs(entityType, entityId, createdAt DESC)`             |

### 6.4 Query practices

- No N+1: `include`/`select` with only needed fields.
- Admin tables use keyset pagination (`WHERE createdAt < :cursor LIMIT 50`).
- Aggregations (KPIs, case stats) run in SQL (`groupBy` / typed `$queryRaw`).
- `pg_stat_statements` enabled; Prisma logs queries > 200 ms as `warn`; investigate with `EXPLAIN ANALYZE`.
- Catalog responses cached in Redis (§8).

### 6.5 Migrations

1. `prisma migrate dev` locally; generated SQL is reviewed and committed.
2. `prisma migrate deploy` in the pre-start container in prod.
3. Applied migrations are never edited.
4. Breaking changes use expand/contract across two releases.
5. CI: `prisma migrate diff` fails if schema and migrations disagree; migrations applied to an empty DB in integration tests.
6. `prisma/seed.ts` seeds demo data: 2 servers, categories, products, cases, and the `OWNER` from env.

---

## 7. Auth, authorization, security

### 7.1 Library choice

Better Auth (MIT, self-hosted, TypeScript; OTP, magic link, Google, Apple, TOTP, Prisma adapter, built-in rate limiting). Rejected: Auth.js (now maintained by the Better Auth team, new projects pointed to Better Auth), Lucia (deprecated), Clerk/Auth0 (paid SaaS beyond free tier, vendor-held data), Keycloak (JVM server too heavy for CX22). ADR records this.

### 7.2 Login

- Invite-only: a Better Auth hook allows user creation only for an email with a valid invite; invite assigns the role.
- Methods: email OTP (6 digits), Google; Apple configured via env, button hidden without keys.
- TOTP 2FA mandatory for every admin (enforced on first login).
- Sessions in DB; cookie `httpOnly`, `Secure`, `SameSite=Lax`; 7-day sliding expiry; all sessions revoked on role change or admin removal.

### 7.3 Authorization

- Permissions are a TS constant list (e.g. `product.write`, `order.refund`, `order.delivery.retry`, `case.odds.write`, `server.write`, `promo.write`, `role.write`, `admin.invite`, `audit.read`).
- `@RequirePermission(...)` guard on every admin endpoint; role permissions cached in Redis for 60 s, invalidated on change; `OWNER` (system role) bypasses and cannot lose permissions or be deleted.
- Audit-log interceptor records every mutating admin request (before/after) plus auth events (login, failed login, 2FA changes).

### 7.4 Specific protections

- **RCON command injection:** nick regex validated at checkout and again in the worker before rendering; templates support only whitelisted placeholders (`{nick}`).
- **Card testing:** invisible Turnstile + rate limit on checkout.
- **Stripe webhooks:** signature verified over raw body; event IDs deduplicated.
- **Case tokens:** 32 random bytes; only SHA-256 stored.
- **Secrets:** env via Dokploy; `.env.example` in repo; gitleaks + CodeQL in CI; GitHub push protection.
- **Headers:** `helmet` on `api`; CSP with nonce in Next.js; HSTS via Cloudflare.
- **Logging hygiene:** see §12.

### 7.5 Rate limits (`@nestjs/throttler`, Redis storage)

| Endpoint       | Limit                               |
| -------------- | ----------------------------------- |
| Send OTP       | 3 / 10 min per email; 10 / h per IP |
| Verify OTP     | 5 attempts, then code invalidated   |
| Create order   | 10 / min per IP + Turnstile         |
| Validate promo | 20 / min per IP                     |
| Open case      | 30 / min per token                  |
| Admin API      | 300 / min per session               |
| Default        | 100 / min per IP                    |

---

## 8. Redis and queues

Redis (AOF on, `maxmemory 256mb`, `noeviction` as BullMQ requires; all cache keys have TTL) is used for:

1. **BullMQ** queues: `delivery`, `mail`; job schedulers: grant expiry (hourly), outbox sweeper (every minute).
2. **Rate limiting** counters.
3. **Catalog cache** per server + locale, TTL 5 min, invalidated on admin edits.
4. **Pub/sub**: `worker` publishes delivered purchases → `api` streams them over SSE.

Outbox pattern: the Stripe webhook transaction writes `deliveries` rows; after commit a BullMQ job is added with `jobId = deliveryId`; the sweeper re-enqueues `PENDING` deliveries that have no job. Postgres is the source of truth; losing Redis loses no paid delivery.

No RabbitMQ/Kafka: one codebase, low volume, BullMQ covers retries, delays and scheduling. ADR records when a broker would be justified (independent services consuming `order.paid` → RabbitMQ; event volume beyond Postgres → Kafka).

---

## 9. Payments and delivery

### 9.1 Checkout

1. Player picks a server, adds offerings; the cart (Redux slice persisted in `localStorage`) may contain items from several servers, grouped by server.
2. Player enters nick (+ confirmation), email, optional promo, ticks immediate-delivery consent; Turnstile runs.
3. `POST /api/orders`: prices recomputed from DB; promo reserved atomically (`usedCount + 1 WHERE usedCount < maxUses`), discount applied to eligible items across servers; order `PENDING`.
4. Stripe Checkout Session (hosted page): line items in the chosen currency, `metadata.orderId`, customer email, 30-min expiry; card, BLIK, P24 via automatic payment methods. Site shows a demo banner with the test card.
5. Webhook `checkout.session.completed` / `checkout.session.async_payment_succeeded` — one transaction: dedupe event → order `PAID` → `deliveries` per item/server (non-case items) → `grants` for `TIMED` (extend existing active grant) → `case_seeds` + `case_keys` for case items.
6. After commit: enqueue delivery jobs; send receipt and (if cases) the opening link via Resend.
7. Success page polls `GET /api/orders/{publicId}` until `DELIVERED`.
8. `checkout.session.expired` → order `EXPIRED`, promo reservation released.

### 9.2 Delivery worker

- `rcon-client`, commands sent sequentially per delivery; responses stored.
- Error handling:

| Situation                           | Action                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Connect/auth failed; nothing sent   | Retry with backoff 10 s → 1 m → 5 m → 15 m → 1 h …, max 10 attempts → `FAILED` + alert                      |
| Command sent, no response (timeout) | No automatic retry (commands may be non-idempotent) → `NEEDS_REVIEW`; admin chooses "mark done" or "resend" |

- Alert: email to `OWNER` + dashboard indicator. Order becomes `DELIVERED` when all its deliveries are `DONE`.

### 9.3 Expiry, refund, dispute

- **Expiry (hourly):** grants past `expiresAt` → in one transaction set `revokedAt` and create `REVOKE` deliveries. Refund policy states the duration is precise to the hour.
- **Refund:** admin with `order.refund` → Stripe Refund API → `charge.refunded` webhook → order `REFUNDED`, revoke deliveries for delivered items, active grants revoked, unopened case keys voided. Button disabled if any key of the order is opened. Whole-order refunds only.
- **Dispute:** `charge.dispute.created` → order `DISPUTED`, same revoke flow plus revoke of already delivered case prizes, audit entry.

### 9.4 Local and test

- Local webhooks via `stripe listen --forward-to localhost/api/webhooks/stripe`.
- e2e uses a fake `PaymentsGateway` that emits signed webhooks.

---

## 10. Provably fair cases and scratch cards

### 10.1 Seeds

1. On payment a `serverSeed` (32 bytes) is created per order; its SHA-256 hash is shown on `/open/{token}` before any opening.
2. The browser generates a `clientSeed`; the player may change it before each opening (stored per key).
3. `nonce` = index of the opening within the order (0, 1, 2…).
4. `serverSeed` is revealed after the order's last key is opened.

### 10.2 Algorithm (`packages/shared`, Web Crypto — identical in Node and browser)

```
hmac = HMAC-SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}`)
x    = first 52 bits of hmac as integer
roll = floor(x / 2^52 * W)            // W = sum of weights in the snapshot
prize = first prize (sorted by id) whose cumulative weight > roll
```

### 10.3 Odds snapshot

The prize table (product IDs + weights) is copied into each `case_key` at payment. Openings and `/fairness` always use the snapshot; later odds edits never affect bought keys.

### 10.4 Opening

1. `POST /api/open/{token}` `{ keyId, clientSeed }`.
2. Atomic claim `UPDATE case_keys SET openedAt = now() WHERE id = :keyId AND openedAt IS NULL AND voidedAt IS NULL`.
3. Compute prize, create `GRANT` delivery on the key's server in the same transaction; respond `{ prize, nonce, serverSeedHash }` (+ `serverSeed` for the last key).
4. Animation starts after the response and lands on the known prize; the reel content is decorative.
5. Admin cannot save a case whose prize products lack an offering on a server where the case is sold.

### 10.5 Scratch cards

Same outcome algorithm; subsequent HMAC bytes deterministically build a 3×3 grid with exactly one triple matching the prize. Grid is presentation only. Canvas scratch with a "Reveal all" button for keyboard and reduced motion.

### 10.6 Age gate and `/fairness`

- 18+ modal before the first opening; choice stored in a necessary cookie; 18+ badge on case cards.
- `/fairness`: inputs `serverSeed`, `clientSeed`, `nonce`, snapshot → result with each step shown; "Verify" from opening history pre-fills; EN/PL explanation.

---

## 11. Frontend

### 11.1 Stack

- Next.js 16 (App Router, React 19, Turbopack), Tailwind v4, shadcn/ui in `packages/ui`, Motion for animation, selected Magic UI components.
- next-intl: `[locale]` segment, detection in `proxy.ts`, typed message keys, CI check that `pl.json` has every key of `en.json`, prices via `useFormatter`.
- Server Components render catalog pages (ISR `revalidate: 60`); RTK Query (generated hooks) for cart, checkout, order polling, case opening and all admin data.
- Forms: react-hook-form + `@hookform/resolvers/valibot` with shared schemas.
- Admin: TanStack Table (shadcn data table), shadcn charts for case stats; whole app `noindex`.
- Legal pages as MDX per locale: Terms, Privacy, Refunds, Cookies (templates marked "demo, not legal advice").
- Errors: `error.tsx` per segment + `global-error.tsx` → Sentry.

### 11.2 Consent and analytics

- Own shadcn banner: categories necessary / analytics; choice in a cookie; texts from next-intl.
- gtag loaded with Consent Mode v2 default `denied`; banner calls `gtag('consent','update',{analytics_storage:'granted'})`.
- Events: `page_view`, `add_to_cart`, `begin_checkout`, `case_open`; `purchase` sent server-side via Measurement Protocol from the webhook, only if the order has a `gaClientId` (captured at checkout only when analytics consent is granted).

### 11.3 SEO

- `app/robots.ts`, `app/sitemap.ts` with `hreflang` alternates; `admin.<domain>` and `/open/*` `noindex`.
- `generateMetadata` per page (title, description, canonical, alternates).
- `opengraph-image.tsx` per product and case.
- JSON-LD `Product`/`Offer` on product pages.
- Localized `not-found.tsx`.

### 11.4 Accessibility and performance

- Target WCAG 2.2 AA; axe checks in Playwright; keyboard-operable roulette and scratch; `prefers-reduced-motion` skips animations.
- `next/image` (R2 via `cdn.<domain>`), `next/font`.
- Lighthouse CI: Performance and Accessibility ≥ 90 on PRs; README badge.

### 11.5 Page inventory

**Storefront (`web`, EN/PL)**

| Page                          | Function                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `/` Home                      | Server picker, featured products and cases, live purchase feed, how-it-works, demo banner        |
| `/[server]` Catalog           | Category tabs, product cards with price in locale currency, 18+ badges on cases                  |
| `/[server]/[product]` Product | Description, price, add to cart, JSON-LD, OG image                                               |
| `/cases/[case]` Case info     | Prize table with published odds, link to `/fairness`                                             |
| Cart (drawer) + `/checkout`   | Items grouped by server, promo, nick + confirmation, email, consent checkbox, Turnstile → Stripe |
| `/order/[publicId]`           | Payment result, delivery progress per server                                                     |
| `/open/[token]`               | Age gate, server seed hash, client seed editor, keys list, roulette / scratch, history, reveal   |
| `/fairness`                   | Verifier and explanation                                                                         |
| `/legal/[slug]`               | Terms, Privacy, Refunds, Cookies                                                                 |
| 404                           | Localized not-found                                                                              |

**Admin (`admin`, EN)**

| Page                       | Function                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `/login`                   | Email OTP, Google, (Apple), 2FA setup/verify                                                      |
| `/` Dashboard              | KPI cards, delivery health (queue size, FAILED, NEEDS_REVIEW, RCON status per server), case stats |
| `/orders`, `/orders/[id]`  | Search by nick/email/publicId, details, deliveries log, retry/mark done, refund                   |
| `/servers`                 | CRUD, RCON credentials, "test connection"                                                         |
| `/categories`, `/products` | CRUD, translations (missing-PL report), offerings per server, commands, prices, images            |
| `/cases`                   | CRUD, prizes and weights, preview of odds                                                         |
| `/promo-codes`             | CRUD, usage                                                                                       |
| `/team`                    | Admins, invites, roles and permission matrix                                                      |
| `/audit`                   | Audit log with filters                                                                            |

---

## 12. Logging, monitoring, backups, files

### 12.1 Logging

- pino via `nestjs-pino` (JSON to stdout, viewed in Dokploy). Sentry free tier for frontend and backend errors with source maps and release = git SHA. Free uptime monitor on `/health`.
- `requestId` in AsyncLocalStorage, propagated into BullMQ job data; log records carry `requestId`, `orderId`, `deliveryId` when known.
- What is logged:

| Place                      | Level / content                                                          |
| -------------------------- | ------------------------------------------------------------------------ |
| Global exception filter    | `error` + stack + `requestId`; client gets generic message + `requestId` |
| Stripe webhooks            | `info` received/processed/duplicate; `warn` bad signature                |
| Delivery worker            | `info` each attempt; `warn` retry; `error` `FAILED` / `NEEDS_REVIEW`     |
| Business events            | `info` order created/paid/delivered/refunded, admin actions, logins      |
| Schedulers                 | `info` start/end/count                                                   |
| Prisma slow query > 200 ms | `warn`                                                                   |
| Rate limit hit             | `warn` IP + route                                                        |
| Frontend                   | `error.tsx` → Sentry                                                     |

- Never logged: RCON passwords, tokens, OTP codes, cookies, `Authorization`, Stripe secrets (pino `redact`); emails masked.

### 12.2 Backups

1. `backup` container with supercronic, daily 03:00.
2. `pg_dump -Fc` → `age` encryption (key stored off-server) → R2 `backups` bucket.
3. Retention 7 daily / 4 weekly / 3 monthly, pruned by the script.
4. Weekly GitHub Action restores the latest backup into a temporary Postgres and runs a sanity query; README badge.
5. Redis is not backed up.

### 12.3 Files (R2)

1. Admin sends file type and size; `api` validates (png/jpeg/webp, ≤ 2 MB) and signs a presigned **PUT** with `Content-Type` and `Content-Length` (R2 has no presigned POST).
2. Browser uploads directly to `media/tmp/`.
3. `api` verifies via `HEAD` and copies to `media/products/`.
4. Lifecycle rule expires `tmp/` after 1 day.

- `media` served publicly via `cdn.<domain>`; `backups` private. `@aws-sdk/client-s3`. Local S3-compatible container in compose (MinIO if images are still published, otherwise Garage).

---

## 13. Testing

| Level       | Tool                                    | Covers                                                                                                                                 |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Jest                                    | money/discounts, provably fair, RCON error classification, permission guard, nick validation, command templating                       |
| Component   | Jest + React Testing Library            | cart grouping, cookie banner, age gate, forms                                                                                          |
| Integration | Jest + Testcontainers (Postgres, Redis) | webhook → transaction → deliveries; 20 parallel promo uses with limit 1 → exactly one success; double key open; migrations on empty DB |
| Contract    | CI scripts                              | `openapi.json` current; `pl.json` complete; schema ↔ migrations                                                                        |
| E2E         | Playwright (desktop + mobile projects)  | scenarios below                                                                                                                        |

Provably fair: fixed test vectors; chi-square over 100 000 rolls; `fast-check` properties (valid index, zero weight never wins); Node and jsdom produce identical results.

E2E environment: compose stack + fake RCON server (records commands) + fake Stripe gateway + Mailpit.

1. Buy VIP (Survival) + key (SkyBlock) → correct commands on each fake RCON → `DELIVERED`.
2. Buy 3 keys → link from Mailpit → age gate → 3 openings → prizes delivered → seed revealed → `/fairness` confirms.
3. RCON down → retries → `FAILED` → admin retry with RCON up → delivered.
4. Admin OTP (Mailpit) + TOTP (`otplib`) → create product → visible on storefront within a minute → refund → revoke command sent.
5. `SUPPORT` has no refund button; direct API call → 403.
6. No `_ga` cookie before consent, present after; EN/PL switch; `robots.txt` and `sitemap.xml` served.
7. axe on home, catalog, cart, open page, admin.

CI: parallel jobs; coverage gates `packages/shared` ≥ 95%, `api` domain ≥ 80% (Codecov badge); Playwright traces/videos uploaded on failure.

---

## 14. Legal and compliance notes

- Mojang's commercial usage guidelines restrict selling gameplay advantages and paid random rewards. The README states this is a portfolio demo in Stripe test mode; the exact guideline text is checked before writing the README.
- EU digital content: mandatory immediate-delivery consent waives the 14-day withdrawal right; captured as `deliveryConsentAt`.
- GDPR: consent-gated analytics; privacy page lists processors (Stripe, Resend, Cloudflare, Sentry, Google Analytics).
- Loot boxes: published odds, provably fair, 18+ gate.

---

## 15. Roadmap (sub-projects)

Each sub-project: own implementation plan → PR(s) → green CI → deploy.

| #   | Sub-project             | Delivers                                                                                                                                                                                                                                                                                                                                                                                                            | Depends on |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Foundation              | Monorepo, tooling (ESLint, Prettier, Husky, commitlint), Docker compose with Traefik/Postgres/Redis, NestJS + Next.js skeletons with liveness `/api/health` (returns deployed version), CI skeleton, VPS + Cloudflare + Dokploy deploy of skeleton, `CLAUDE.md`, first ADRs. Mailpit, local S3, DB/Redis health checks and the `worker` entrypoint arrive with the sub-projects that first use them (3/4, 3, 2, 5). | —          |
| 2   | Data & catalog          | Prisma schema (all tables), migrations, seed, catalog API with translations, Redis cache, ValibotPipe, Swagger + OpenAPI codegen, contract checks                                                                                                                                                                                                                                                                   | 1          |
| 3   | Admin auth & management | Better Auth (OTP, Google, Apple-ready, 2FA, invites), roles/permissions, audit log, admin shell, CRUD for servers/categories/products/cases/promo, R2 uploads                                                                                                                                                                                                                                                       | 2          |
| 4   | Checkout & payments     | Cart, orders, promo reservation, Stripe gateway + fake gateway, webhooks, receipts via Resend, order status page                                                                                                                                                                                                                                                                                                    | 2          |
| 5   | Delivery                | Outbox + BullMQ, RCON client, retries/NEEDS_REVIEW, grants + hourly expiry, refunds/disputes with revoke, dashboard KPIs and delivery health, fake RCON server                                                                                                                                                                                                                                                      | 4          |
| 6   | Storefront              | Home, catalog, product pages, i18n EN/PL, legal MDX, cookie banner + GA4, SEO files, OG images, a11y, live feed (SSE)                                                                                                                                                                                                                                                                                               | 2, 4       |
| 7   | Gambling                | Case keys, provably fair, roulette and scratch UIs, `/open`, `/fairness`, age gate, case stats on dashboard                                                                                                                                                                                                                                                                                                         | 5, 6       |
| 8   | Ops & showcase          | pino/Sentry/uptime, backups + restore CI, Lighthouse CI, coverage gates, remaining ADRs, README with AI section                                                                                                                                                                                                                                                                                                     | all        |

Parallel track: visual design from the owner's references, applied during sub-projects 6–7.

---

## 16. Items to verify during implementation

1. Hetzner current entry-level plan name/price (CX22 or successor).
2. Better Auth integration approach in NestJS (official/community adapter vs mounting the handler).
3. MinIO container image availability for local S3; fallback Garage.
4. Resend free-plan limits at implementation time.
5. Exact Mojang commercial usage guideline wording for the README.
