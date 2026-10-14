# ADR 0009: Better Auth inside NestJS

- Status: Accepted
- Date: 2026-10-14

## Context

The parent spec (§7.1) picks Better Auth for admin sign-in: email OTP, Google, Apple (disabled until keys exist), mandatory TOTP, invite-only. Business logic lives only in `apps/api`, and the Next.js apps have no route handlers, so the auth server cannot live in `apps/admin`. Design: `docs/superpowers/specs/2026-10-12-admin-access-design.md`.

## Decision

- Better Auth 1.7.7 runs in `apps/api` through `@thallesp/nestjs-better-auth` 2.8.0, mounted under `/api/auth`. The app is created with `bodyParser: false`; the integration re-adds JSON parsing outside `/api/auth` and enables CORS (credentials) for the admin origin only.
- The admin app reaches the API same-origin: Traefik (dev) and Dokploy (production) route `admin.<domain>/api/*` to `shop-api`. `BETTER_AUTH_URL` is the public admin origin, so cookies and OAuth callbacks live on that origin.
- Admin endpoints use `@AdminController(path)` (session, TOTP, permission and audit in one decorator) and `@RequirePermission(...)`. Our `AdminSessionGuard` replaces the integration's global guard for `/api/admin/*`. Permissions are fixed in `@shop/shared/access`; `OWNER` always has all of them. A member cannot grant a permission they do not hold (403 `cannot_grant`).
- TOTP is mandatory and enforced by our own hooks, not by Better Auth: a session counts as verified (`session.twoFactorVerifiedAt`) only after `verify-totp`, or `verify-backup-code` for an already enrolled user. The 2FA settings endpoints are refused for unverified sessions of enrolled users, and the first enrollment must go through `verify-totp` (enrollment hands out backup codes before the TOTP is proven).
- Sign-up is invite-only through `databaseHooks.user.create`: it throws `FORBIDDEN` (returning `false` gives a 500 in Better Auth 1.7) and the invite is marked accepted in `after`. OAuth sign-ups go through the same hook.
- Rate limits and audit rows share one client IP rule (`TRUST_CF_CONNECTING_IP`, see the runbook). Limits are overridable through `RATE_LIMIT_*` env vars.

## Consequences

- Public controllers (health, catalog) need `@AllowAnonymous()`; the integration's global guard runs first on every route, including anonymous ones.
- `auth` is built outside Nest DI (a lazy proxy over `getAuth()`), with its own Prisma client; it shares `getMailer()` with the Nest mailer provider. Admin requests do two session lookups (integration guard, then ours).
- The auth packages are ESM-only: Node 24 loads them with `require(esm)` and Jest needs `--experimental-vm-modules` (already in the scripts). Integration tests start Redis via `@testcontainers/redis`.
- Better Auth 1.7 needs `twoFactor.failedVerificationCount` and `lockedUntil` (a migration after the initial schema).
- Production refuses to start without `BETTER_AUTH_SECRET` (32+ chars) and `BETTER_AUTH_URL`; the dev fallbacks are public and never used when `NODE_ENV=production`.
- `TRUST_CF_CONNECTING_IP=true` is safe only when the origin is reachable solely through Cloudflare (the Hetzner firewall allows only Cloudflare ranges); otherwise the header can be forged.
- TOTP replay: Better Auth accepts a code for the previous, current and next 30 s step and records no used step. Our before-hook claims `totp:used:<userId>:<code>` in Redis for 90 s with one atomic `SET NX` and refuses a code that is already claimed with 403 `totp_reused` (two racing requests cannot both pass; Redis down refuses every code: fail closed). The after-hook gives the claim back when the check failed, so only a code that passed stays used. TOTP and backup-code checks are capped at 5 per minute and 30 per day per user (`RATE_LIMIT_2FA_DAY`).
- Admin protection is enforced by a test, not only by convention: `admin-routes.spec.ts` boots the module graph and fails if any controller under `admin/` lacks `AdminSessionGuard`, `PermissionGuard` or the audit interceptor.
- Grant escalation is blocked: invites, role changes and role edits are limited to permissions the actor holds (403 `cannot_grant`).
