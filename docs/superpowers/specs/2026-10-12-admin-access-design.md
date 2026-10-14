# Sub-project 3a: Admin access

- Date: 2026-10-12
- Status: Draft, awaiting owner review
- Parent spec: `2026-10-01-minecraft-donation-shop-design.md` (roadmap row 3, §6.2 "Admin", §7). This document narrows it as noted.

## 1. Goal

Shop staff (`OWNER`, `ADMIN`, `SUPPORT`) sign in to the admin app securely, and the owner manages the team. This is the base for the next admin sub-projects.

Sub-project 3 is split into three parts, each with its own spec, plan and PR:

| Part | Delivers                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 3a   | Admin access: Better Auth, invites, mandatory 2FA, roles and permissions, audit log, mailer, admin shell, `/team`, `/audit` (this document) |
| 3b   | Catalog management: CRUD for servers, categories, products, prices and translations; R2 image uploads                                       |
| 3c   | Site content: phase 2 of `2026-10-09-site-content-design.md` (rules with draft and publish, brand settings, homepage text overrides)        |

Case CRUD moves to sub-project 7 and promo-code CRUD to sub-project 4: their tables are created by those sub-projects. **Narrows parent roadmap row 3.**

Success:

- An invited person signs in with an emailed code or Google, sets up TOTP, and reaches the admin shell.
- Nobody without a valid invite can create an account.
- A session without a verified TOTP cannot call any admin endpoint.
- The owner invites people, changes roles and their permissions, removes admins, resets another admin's 2FA, and reads the audit log.
- A role change or removal ends that person's sessions.
- `pnpm build` in CI still needs no API or database.

## 2. Decisions

| #   | Topic             | Decision                                                                                                                                                                                                                           |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where auth runs   | Better Auth inside `apps/api` (NestJS) at `/api/auth/*`, through `@thallesp/nestjs-better-auth`. Next apps have no route handlers (CLAUDE.md). ADR 0009 records it (0008 is reserved for site content).                            |
| 2   | Same-origin calls | The admin app reaches the API through its own `/api`, the same way the storefront does (`proxy.ts` in production, rewrites in dev). Session cookies are first-party on the admin host.                                             |
| 3   | Sign-in methods   | Email OTP (6 digits, stored hashed, 5 attempts) and Google. Apple is configured from env and its button is hidden without keys.                                                                                                    |
| 4   | Invite only       | A `user.create.before` database hook allows sign-up only for an email with a valid, unexpired invite; the invite's role is assigned. OTP sign-up for other emails is refused.                                                      |
| 5   | Mandatory 2FA     | TOTP for every admin. Better Auth's `twoFactor` plugin challenges credential sign-ins; for email OTP and Google we enforce it ourselves: a session is "verified" only after a TOTP or backup-code check in that session.           |
| 6   | Permissions       | A TS constant list in `@shop/shared`, shared by API and admin. 3a defines only `admin.invite`, `role.write`, `audit.read`; later sub-projects add theirs.                                                                          |
| 7   | Roles             | DB table with `permissions text[]` and `isSystem`. Seeded `OWNER` (all, always; cannot be deleted, demoted or lose permissions), `ADMIN` (`admin.invite`, `audit.read`), `SUPPORT` (none yet; order permissions in sub-project 4). |
| 8   | Permission cache  | Role permissions cached in Redis for 60 s, invalidated on change.                                                                                                                                                                  |
| 9   | Audit             | An interceptor records every mutating admin request (before / after) plus auth events.                                                                                                                                             |
| 10  | Email             | A `Mailer` interface: Resend in production (account and API key exist), Mailpit locally and in e2e, an in-memory fake in integration tests. Templates in React Email, EN.                                                          |
| 11  | First owner       | The seed creates the three system roles and an invite for `ADMIN_OWNER_EMAIL`, prints the invite link and emails it.                                                                                                               |
| 12  | Admin data access | RTK Query with code generated from the committed `openapi.json` (parent §5 step 4, deferred to here by the data-catalog spec).                                                                                                     |
| 13  | Admin language    | EN only (parent decision #6).                                                                                                                                                                                                      |

## 3. Data model (Prisma)

- Better Auth tables: `user`, `session`, `account`, `verification`, `twoFactor` (generated by the Better Auth CLI, then kept in `schema.prisma`).
- `user` additions: `roleId`, `disabledAt?`.
- `session` addition: `twoFactorVerifiedAt?` (decision #5).
- `roles` — `id`, `name` (unique), `permissions text[]`, `isSystem`, timestamps.
- `invites` — `email`, `roleId`, `tokenHash` (unique, SHA-256 of 32 random bytes), `invitedById`, `expiresAt` (7 days), `acceptedAt?`, `revokedAt?`, `createdAt`.
- `audit_logs` — `actorId?` (null for failed sign-ins), `action`, `entityType?`, `entityId?`, `before jsonb?`, `after jsonb?`, `ip`, `createdAt`. Index on `(createdAt desc)` and `(actorId, createdAt desc)`.

Removing an admin sets `disabledAt` and deletes their sessions; the row stays so audit entries keep their actor.

## 4. API (`apps/api`)

| Module   | Responsibility                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`   | Better Auth instance (Prisma adapter, `emailOTP`, `twoFactor`, Google, optional Apple), invite hook, `twoFactorVerifiedAt` stamping, session rules. `bodyParser: false` in `main.ts` as the integration requires. |
| `access` | `@RequirePermission(...)` guard, `AdminSessionGuard` (signed in, not disabled, TOTP verified, else 401 / 403 `2fa_required`), Redis permission cache.                                                             |
| `team`   | `GET /api/admin/me`, admins list, remove admin, reset 2FA, change role; invites create / resend / revoke / accept lookup; roles list, create, update permissions, delete.                                         |
| `audit`  | Interceptor on admin controllers, auth-event hooks, `GET /api/admin/audit` (filters: actor, action, date range; 50 per page, cursor).                                                                             |
| `mailer` | `Mailer` interface, Resend and Mailpit (SMTP) implementations chosen by env, React Email templates: sign-in code, invite, "your 2FA was reset".                                                                   |

The integration's global `AuthGuard` protects everything by default, so the public endpoints (`/api/catalog`, `/api/health`, `/api/health/ready`, `/api/status`, docs) are marked `@AllowAnonymous()`.

Rate limits (`@nestjs/throttler`, Redis storage), from parent §7.5:

| Endpoint   | Limit                                |
| ---------- | ------------------------------------ |
| Send OTP   | 3 / 10 min per email; 10 / h per IP  |
| Verify OTP | 5 attempts, then the code is invalid |
| Admin API  | 300 / min per session                |
| Default    | 100 / min per IP                     |

## 5. Flows

**Invite (first sign-in)**

1. A user with `admin.invite` enters an email and a role in `/team`. The API creates the invite and emails `https://admin.<domain>/invite/<token>`.
2. The invite page shows the email and offers Google or an emailed code. The signed-in email must match the invite.
3. On first sign-in the hook creates the user with the invite's role and marks the invite accepted.
4. TOTP setup is mandatory: QR code, confirm with a code, show 10 backup codes once.
5. The session is stamped `twoFactorVerifiedAt`; the shell opens.

**Returning sign-in**

- Email → 6-digit code → TOTP → shell.
- Google → callback → TOTP → shell.
- Lost phone: a backup code instead of TOTP; or the owner resets the person's 2FA (audited, emailed), and the next sign-in starts TOTP setup again.

**Sessions**

- Stored in the database; cookie `httpOnly`, `Secure`, `SameSite=Lax`; 7-day sliding expiry.
- All of a person's sessions end on role change, removal or 2FA reset.

## 6. Admin app (`apps/admin`)

Pages (shadcn/ui from `@shop/ui`, EN):

| Route             | Content                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `/login`          | Email → code; Google button (Apple when configured)                                       |
| `/invite/[token]` | Sign-in for an invited email; expired or used invites show an error                       |
| `/2fa`            | TOTP setup (QR, confirm, backup codes) or TOTP / backup-code challenge                    |
| `/`               | Welcome placeholder; the dashboard arrives in sub-project 5                               |
| `/team`           | Tabs: admins, invites, roles with a permission matrix; actions follow the viewer's rights |
| `/audit`          | Filterable log table, 50 per page                                                         |
| `/account`        | Regenerate backup codes, sign out everywhere                                              |

- The server layout calls `/api/admin/me` with the request cookies: no session → `/login`; `2fa_required` → `/2fa`.
- Client calls use RTK Query generated from `openapi.json`; the Better Auth client (`better-auth/react`) handles the sign-in calls.
- Navigation and actions hide what the viewer has no permission for; the API still enforces every check.
- Forms follow ADR 0006 (react-hook-form + Valibot).

## 7. Errors and edge cases

1. Expired, revoked or accepted invite: the invite page says so; sign-up is refused by the hook either way.
2. Signed-in email differs from the invite: refused, nothing is created.
3. Disabled admin signs in: refused and audited.
4. Owner tries to delete, demote or strip the `OWNER` role: 400, nothing changes.
5. Removing the last user who holds `role.write` other than the owner is allowed; the owner always keeps every permission.
6. Mailer failure: the OTP request returns success without revealing whether the email exists (no account enumeration); the failure is logged.
7. Redis down: the permission check falls back to the database; rate limiting fails closed for OTP sending.

## 8. Testing

- **Unit:** permission guard, session guard (`2fa_required`), invite hook, audit interceptor (before / after), permission cache invalidation, OWNER protections.
- **Integration (Testcontainers):** OTP sign-in and invite acceptance through `auth.api`, refused sign-up without invite, TOTP verification stamps the session, role change revokes sessions, audit rows written. Email through an in-memory `Mailer`.
- **e2e (Playwright):** invite → code read from the Mailpit API → sign-in → TOTP via `otplib` → `/team`; `SUPPORT` cannot open `/audit`; a role change signs the person out. The e2e stack gains a Mailpit service and a seeded owner.
- First plan task is a spike: confirm the NestJS integration, `bodyParser: false` with the existing `ValibotPipe` and JSON endpoints, and the TOTP enforcement for OTP and Google sessions, before building on them.

## 9. Docs and config

- ADR 0009: Better Auth inside NestJS.
- CLAUDE.md: admin auth rule (guards, `@AllowAnonymous` for public endpoints, permissions in `@shop/shared`).
- `.env.example` and the deploy runbook: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_*` (optional), `ADMIN_OWNER_EMAIL`, `REDIS_URL`.
- Google Cloud Console (owner): JavaScript origins `https://admin.<domain>`, `http://admin.shop.localhost`; redirect URIs `https://admin.<domain>/api/auth/callback/google`, `http://admin.shop.localhost/api/auth/callback/google` (confirm the path against the installed Better Auth version).

## 10. Out of scope

Catalog CRUD (3b), site content (3c), cases (7), promo codes (4), dashboard KPIs (5), Apple keys.
