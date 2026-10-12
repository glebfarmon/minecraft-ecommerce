# Admin Access (Sub-project 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invited staff sign in to the admin app with an emailed code or Google, must pass TOTP, and the owner manages admins, invites, roles and reads the audit log.

**Architecture:** Better Auth runs inside `apps/api` (NestJS) at `/api/auth/*` through `@thallesp/nestjs-better-auth`, on new Prisma tables. Our own guards add "invite only", "TOTP verified in this session", permissions (shared list in `@shop/shared/access`, Redis-cached) and an audit interceptor. `apps/admin` reaches the API through its own `/api` (Traefik routes `admin.<host>/api/*` to the API), uses the Better Auth React client for sign-in and RTK Query generated from `openapi.json` for team data.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`, CJS client), Better Auth 1.6 (`emailOTP`, `twoFactor`, Google, Apple), `@thallesp/nestjs-better-auth`, ioredis, `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`, Resend, nodemailer (Mailpit), React Email, Next.js 16 admin, RTK Query + `@rtk-query/codegen-openapi`, react-hook-form + Valibot, Playwright, otplib, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-10-12-admin-access-design.md`

## Global Constraints

- Business logic only in `apps/api`; Next apps have no route handlers.
- NestJS global prefix `/api`; ports web 3000, admin 3001, api 4000.
- Admin UI is EN only.
- Do not bump ESLint (9) or TypeScript (6) majors.
- Permissions are a TS constant list in `@shop/shared/access`; 3a defines only `admin.invite`, `role.write`, `audit.read`.
- System roles: `OWNER` (all, always; cannot be deleted, demoted or lose permissions), `ADMIN` (`admin.invite`, `audit.read`), `SUPPORT` (none).
- Invites: 32 random bytes, only SHA-256 stored, expire after 7 days.
- Email OTP: 6 digits, stored hashed, 5 attempts.
- Sessions: database, `httpOnly`, `Secure` (production), `SameSite=Lax`, 7-day sliding expiry; all of a user's sessions end on role change, removal or 2FA reset.
- A session may call admin endpoints only if the user is not disabled and the session has `twoFactorVerifiedAt`.
- Public endpoints (`/api/catalog`, `/api/health`, `/api/health/ready`, `/api/status`, `/api/docs`) stay anonymous.
- Rate limits: send OTP 3 / 10 min per email and 10 / h per IP; admin API 300 / min per session; default 100 / min per IP.
- The OTP request never reveals whether an email exists.
- Never commit secrets; new env vars go to `.env.example`.
- TDD: failing test first. Before each commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (plus `pnpm test:int` for tasks that touch the database). Conventional Commits, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Use Context7 (`/better-auth/better-auth/v1.6.23`) before guessing a Better Auth API. Run `graphify query` before grepping; `graphify update .` after editing code.

## Review Focus

1. A Google sign-in for an email without an invite must not create a user (OAuth goes through the same `user.create.before` hook). Pinned in Task 5.
2. A session that passed the email code but not TOTP must get 403 `2fa_required` on every admin route, including ones added later; the guard is global for `/api/admin/*`. Pinned in Task 6.
3. Changing a role's permissions must take effect within the 60 s cache, and immediately for the editor's own next request (cache invalidated on write). Pinned in Task 6.
4. The owner must not be able to lock themselves out: no endpoint may disable, demote, reset-2FA or delete the `OWNER` user or role. Pinned in Task 8.
5. Audit entries must never contain secrets: OTP codes, TOTP secrets, backup codes and invite tokens are redacted from `before`/`after`. Pinned in Task 7.

## File Structure

```
packages/shared/src/access.ts            permission list, system roles, team/audit contract schemas
apps/api/prisma/schema.prisma            + User, Session, Account, Verification, TwoFactor, Role, Invite, AuditLog
apps/api/prisma/migrations/2026101213xxxx_admin_access/
apps/api/src/redis/redis.module.ts       ioredis client provider (REDIS_URL)
apps/api/src/mailer/                      Mailer interface, Memory/Smtp/Resend, templates (.tsx), MailerModule
apps/api/src/auth/auth.ts                 createAuth(): Better Auth instance and its hooks
apps/api/src/auth/invite-gate.ts          user.create.before: invite-only sign-up
apps/api/src/auth/auth.module.ts          wires @thallesp/nestjs-better-auth
apps/api/src/access/                      AdminSessionGuard, RequirePermission, PermissionCache
apps/api/src/team/                        me, admins, invites, roles controllers + services
apps/api/src/audit/                       AuditService, AuditInterceptor, redaction, audit controller
apps/api/src/throttle/                    ThrottlerModule with Redis storage
apps/api/src/seed/seed-access.ts          system roles + owner invite
apps/admin/src/lib/auth-client.ts         Better Auth React client
apps/admin/src/lib/api/                   RTK Query store, generated endpoints
apps/admin/src/lib/session.ts             server: getMe() with request cookies
apps/admin/src/app/(auth)/                login, invite/[token], 2fa
apps/admin/src/app/(shell)/               layout with nav, /, team, audit, account
e2e/tests/admin.spec.ts                   invite → code → TOTP → team; permissions
docs/adr/0009-better-auth-in-nestjs.md
```

---

### Task 1: Access contract in `@shop/shared`

**Files:**

- Create: `packages/shared/src/access.ts`
- Test: `packages/shared/src/access.spec.ts`
- Modify: `packages/shared/package.json` (exports `./access`)

**Interfaces:**

- Produces (all from `@shop/shared/access`): `PERMISSIONS`, `type Permission`, `PermissionSchema`, `SYSTEM_ROLES: Record<SystemRoleName, readonly Permission[]>`, `type SystemRoleName = 'OWNER' | 'ADMIN' | 'SUPPORT'`, `hasPermission(granted, needed): boolean`, schemas and inferred types `RoleSchema/Role`, `RoleInputSchema/RoleInput`, `MeSchema/Me`, `AdminSchema/Admin`, `InviteSchema/Invite`, `CreateInviteSchema/CreateInvite`, `ChangeRoleSchema/ChangeRole`, `InviteLookupSchema/InviteLookup`, `AuditQuerySchema/AuditQuery`, `AuditEntrySchema/AuditEntry`, `AuditPageSchema/AuditPage`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/access.spec.ts`:

```ts
import * as v from 'valibot'

import {
  CreateInviteSchema,
  PERMISSIONS,
  RoleInputSchema,
  SYSTEM_ROLES,
  hasPermission
} from './access'

describe('access contract', () => {
  it('gives the owner every permission and support none', () => {
    expect([...SYSTEM_ROLES.OWNER].sort()).toEqual([...PERMISSIONS].sort())
    expect(SYSTEM_ROLES.ADMIN).toEqual(['admin.invite', 'audit.read'])
    expect(SYSTEM_ROLES.SUPPORT).toEqual([])
  })

  it('checks a permission', () => {
    expect(hasPermission(['audit.read'], 'audit.read')).toBe(true)
    expect(hasPermission(['audit.read'], 'role.write')).toBe(false)
  })

  it('normalises an invite email', () => {
    expect(v.parse(CreateInviteSchema, {email: ' Ann@Example.COM ', roleId: 'r1'})).toEqual({
      email: 'ann@example.com',
      roleId: 'r1'
    })
    expect(v.safeParse(CreateInviteSchema, {email: 'nope', roleId: 'r1'}).success).toBe(false)
  })

  it('rejects unknown permissions and odd role names', () => {
    expect(v.safeParse(RoleInputSchema, {name: 'Editor', permissions: ['root']}).success).toBe(
      false
    )
    expect(v.safeParse(RoleInputSchema, {name: 'x', permissions: []}).success).toBe(false)
    expect(v.parse(RoleInputSchema, {name: ' Editor ', permissions: ['audit.read']})).toEqual({
      name: 'Editor',
      permissions: ['audit.read']
    })
  })
})
```

- [ ] **Step 2: Run it** — `pnpm --filter @shop/shared test -- access` → FAIL: cannot find module `./access`.

- [ ] **Step 3: Implement** — `packages/shared/src/access.ts`:

```ts
import * as v from 'valibot'

/** Every permission the admin API checks. Later sub-projects append theirs. */
export const PERMISSIONS = ['admin.invite', 'role.write', 'audit.read'] as const
export type Permission = (typeof PERMISSIONS)[number]
export const PermissionSchema = v.picklist(PERMISSIONS)

export type SystemRoleName = 'OWNER' | 'ADMIN' | 'SUPPORT'
/** Seeded roles. OWNER always has every permission, whatever the table says. */
export const SYSTEM_ROLES: Record<SystemRoleName, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: ['admin.invite', 'audit.read'],
  SUPPORT: []
}

export const hasPermission = (granted: readonly Permission[], needed: Permission): boolean =>
  granted.includes(needed)

const Id = v.pipe(v.string(), v.minLength(1))
const Email = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email())
const Timestamp = v.pipe(v.string(), v.isoTimestamp())
const RoleRef = v.object({id: Id, name: v.string()})

export const RoleSchema = v.object({
  id: Id,
  name: v.string(),
  isSystem: v.boolean(),
  permissions: v.array(PermissionSchema)
})
export type Role = v.InferOutput<typeof RoleSchema>

export const RoleInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(40)),
  permissions: v.array(PermissionSchema)
})
export type RoleInput = v.InferOutput<typeof RoleInputSchema>

export const MeSchema = v.object({
  id: Id,
  email: v.string(),
  name: v.string(),
  role: RoleSchema,
  permissions: v.array(PermissionSchema)
})
export type Me = v.InferOutput<typeof MeSchema>

export const AdminSchema = v.object({
  id: Id,
  email: v.string(),
  name: v.string(),
  role: RoleRef,
  twoFactorEnabled: v.boolean(),
  disabledAt: v.nullable(Timestamp)
})
export type Admin = v.InferOutput<typeof AdminSchema>

export const InviteSchema = v.object({
  id: Id,
  email: v.string(),
  role: RoleRef,
  expiresAt: Timestamp,
  acceptedAt: v.nullable(Timestamp),
  revokedAt: v.nullable(Timestamp)
})
export type Invite = v.InferOutput<typeof InviteSchema>

export const CreateInviteSchema = v.object({email: Email, roleId: Id})
export type CreateInvite = v.InferOutput<typeof CreateInviteSchema>

export const ChangeRoleSchema = v.object({roleId: Id})
export type ChangeRole = v.InferOutput<typeof ChangeRoleSchema>

export const InviteLookupSchema = v.object({
  email: v.string(),
  status: v.picklist(['valid', 'expired', 'used', 'revoked'])
})
export type InviteLookup = v.InferOutput<typeof InviteLookupSchema>

export const AuditQuerySchema = v.object({
  actorId: v.optional(Id),
  action: v.optional(v.pipe(v.string(), v.maxLength(80))),
  from: v.optional(Timestamp),
  to: v.optional(Timestamp),
  cursor: v.optional(Id)
})
export type AuditQuery = v.InferOutput<typeof AuditQuerySchema>

export const AuditEntrySchema = v.object({
  id: Id,
  actor: v.nullable(v.object({id: Id, email: v.string()})),
  action: v.string(),
  entityType: v.nullable(v.string()),
  entityId: v.nullable(v.string()),
  before: v.unknown(),
  after: v.unknown(),
  ip: v.string(),
  createdAt: Timestamp
})
export type AuditEntry = v.InferOutput<typeof AuditEntrySchema>

export const AuditPageSchema = v.object({
  entries: v.array(AuditEntrySchema),
  nextCursor: v.nullable(Id)
})
export type AuditPage = v.InferOutput<typeof AuditPageSchema>
```

In `packages/shared/package.json` add to `exports`:

```json
"./access": {"types": "./dist/access.d.ts", "default": "./dist/access.js"}
```

- [ ] **Step 4: Run** — `pnpm --filter @shop/shared test && pnpm --filter @shop/shared build` → PASS, `dist/access.js` exists.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add packages/shared
git commit -m "feat(shared): admin access contract and permission list"
```

---

### Task 2: Auth and access tables

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_admin_access/migration.sql` (generated)
- Test: `apps/api/test/access-schema.int-spec.ts`

**Interfaces:**

- Produces Prisma models `User` (`@@map("user")`), `Session`, `Account`, `Verification`, `TwoFactor`, `Role` (`roles`), `Invite` (`invites`), `AuditLog` (`audit_logs`), with fields listed below. Later tasks use `prisma.user`, `prisma.session`, `prisma.role`, `prisma.invite`, `prisma.auditLog`.

- [ ] **Step 1: Write the failing test** — `apps/api/test/access-schema.int-spec.ts`:

```ts
import {PrismaService} from '../src/prisma/prisma.service'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('access schema', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
  })
  afterAll(async () => {
    await prisma.$disconnect()
    await db.stop()
  })

  it('keeps role names unique', async () => {
    await prisma.role.create({data: {name: 'Editor', permissions: [], isSystem: false}})
    await expect(
      prisma.role.create({data: {name: 'Editor', permissions: [], isSystem: false}})
    ).rejects.toThrow()
  })

  it('will not delete a role that still has users', async () => {
    const role = await prisma.role.create({data: {name: 'Busy', permissions: [], isSystem: false}})
    await prisma.user.create({
      data: {id: 'u1', email: 'a@example.com', name: 'A', emailVerified: true, roleId: role.id}
    })
    await expect(prisma.role.delete({where: {id: role.id}})).rejects.toThrow()
  })

  it('keeps invite token hashes unique and sessions per user', async () => {
    const role = await prisma.role.create({data: {name: 'Inv', permissions: [], isSystem: false}})
    const invite = {
      email: 'b@example.com',
      roleId: role.id,
      tokenHash: 'h1',
      expiresAt: new Date(Date.now() + 1000)
    }
    await prisma.invite.create({data: invite})
    await expect(prisma.invite.create({data: invite})).rejects.toThrow()
    const session = await prisma.session.create({
      data: {id: 's1', token: 't1', userId: 'u1', expiresAt: new Date(Date.now() + 1000)}
    })
    expect(session.twoFactorVerifiedAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run it** — `docker compose up -d postgres && pnpm --filter @shop/api test:int -- access-schema` → FAIL: `prisma.role` is undefined (TS error in ts-jest).

- [ ] **Step 3: Add the models** to `apps/api/prisma/schema.prisma` (Better Auth models match its Prisma schema for v1.6 with the `twoFactor` plugin; run `pnpm --filter @shop/api exec dlx @better-auth/cli@1.6 generate` only to compare — if a field differs, the CLI output wins for Better Auth models and gets a ledger ruling):

```prisma
model User {
  id               String     @id
  name             String
  email            String     @unique
  emailVerified    Boolean    @default(false)
  image            String?
  twoFactorEnabled Boolean    @default(false)
  roleId           String?
  disabledAt       DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  role             Role?      @relation(fields: [roleId], references: [id], onDelete: Restrict)
  sessions         Session[]
  accounts         Account[]
  twoFactors       TwoFactor[]
  invitesSent      Invite[]   @relation("InviteSender")
  auditLogs        AuditLog[]

  @@map("user")
}

model Session {
  id                  String    @id
  expiresAt           DateTime
  token               String    @unique
  ipAddress           String?
  userAgent           String?
  userId              String
  twoFactorVerifiedAt DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

model TwoFactor {
  id          String  @id
  secret      String
  backupCodes String
  verified    Boolean @default(true)
  userId      String
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("twoFactor")
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  permissions String[]
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       User[]
  invites     Invite[]

  @@map("roles")
}

model Invite {
  id          String    @id @default(cuid())
  email       String
  roleId      String
  tokenHash   String    @unique
  invitedById String?
  expiresAt   DateTime
  acceptedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  role        Role      @relation(fields: [roleId], references: [id], onDelete: Restrict)
  invitedBy   User?     @relation("InviteSender", fields: [invitedById], references: [id], onDelete: SetNull)

  @@index([email])
  @@map("invites")
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String?
  entityId   String?
  before     Json?
  after      Json?
  ip         String
  createdAt  DateTime @default(now())
  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
  @@map("audit_logs")
}
```

Generate the migration and client:

```bash
pnpm --filter @shop/api exec prisma migrate dev --name admin_access
pnpm --filter @shop/api generate
```

- [ ] **Step 4: Run** — `pnpm --filter @shop/api test:int` → PASS (new 3 tests plus the existing `database` drift test, which proves migration and schema agree).

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/api/prisma apps/api/test/access-schema.int-spec.ts
git commit -m "feat(api): auth, role, invite and audit tables"
```

---

### Task 3: Mailer

**Files:**

- Create: `apps/api/src/mailer/mailer.ts`, `memory-mailer.ts`, `smtp-mailer.ts`, `resend-mailer.ts`, `create-mailer.ts`, `templates.tsx`, `mailer.module.ts`
- Test: `apps/api/src/mailer/create-mailer.spec.ts`, `apps/api/src/mailer/templates.spec.tsx`
- Modify: `apps/api/package.json` (deps; jest transform `^.+\\.tsx?$`, `moduleFileExtensions` + `tsx`), `apps/api/tsconfig.json` (`"jsx": "react-jsx"`)

**Interfaces:**

- Produces: `interface Mailer { send(mail: Mail): Promise<void> }`, `type Mail = {to: string; subject: string; html: string; text: string}`, `MAILER` (Nest injection token), `createMailer(env): Mailer`, `getMailer(): Mailer` (process-wide singleton, same instance the Nest provider returns), `class MemoryMailer { sent: Mail[]; lastTo(email): Mail | undefined }`, templates `signInCodeMail(code): Omit<Mail,'to'>`, `inviteMail(link, roleName): Omit<Mail,'to'>`, `twoFactorResetMail(): Omit<Mail,'to'>` (all async, return Promise).

- [ ] **Step 1: Install** — `pnpm --filter @shop/api add resend nodemailer @react-email/components @react-email/render react react-dom && pnpm --filter @shop/api add -D @types/nodemailer @types/react @types/react-dom`. Add `"jsx": "react-jsx"` to `apps/api/tsconfig.json` compilerOptions; in `apps/api/package.json` jest config set `"transform": {"^.+\\.tsx?$": "ts-jest"}`, `"testRegex": ".*\\.(spec|e2e-spec)\\.tsx?$"`, and add `"tsx"` to `moduleFileExtensions`.

- [ ] **Step 2: Write the failing tests**

`apps/api/src/mailer/create-mailer.spec.ts`:

```ts
import {createMailer} from './create-mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

describe('createMailer', () => {
  it('uses Resend when an API key is set', () => {
    expect(createMailer({RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(ResendMailer)
  })
  it('uses SMTP (Mailpit) when SMTP_URL is set', () => {
    expect(createMailer({SMTP_URL: 'smtp://mailpit:1025', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(
      SmtpMailer
    )
  })
  it('keeps mail in memory otherwise', async () => {
    const mailer = createMailer({})
    expect(mailer).toBeInstanceOf(MemoryMailer)
    await mailer.send({to: 'x@y.z', subject: 's', html: '<p>h</p>', text: 'h'})
    expect((mailer as MemoryMailer).lastTo('x@y.z')?.subject).toBe('s')
  })
})
```

`apps/api/src/mailer/templates.spec.tsx`:

```tsx
import {inviteMail, signInCodeMail, twoFactorResetMail} from './templates'

describe('mail templates', () => {
  it('puts the code in the subject, html and text of the sign-in mail', async () => {
    const mail = await signInCodeMail('482913')
    expect(mail.subject).toContain('482913')
    expect(mail.html).toContain('482913')
    expect(mail.text).toContain('482913')
  })
  it('links the invite and names the role', async () => {
    const mail = await inviteMail('https://admin.example.com/invite/abc', 'ADMIN')
    expect(mail.html).toContain('https://admin.example.com/invite/abc')
    expect(mail.text).toContain('ADMIN')
  })
  it('tells the person their 2FA was reset', async () => {
    expect((await twoFactorResetMail()).text).toMatch(/two-factor/i)
  })
})
```

- [ ] **Step 3: Run** — `pnpm --filter @shop/api test -- mailer` → FAIL: modules not found.

- [ ] **Step 4: Implement**

`mailer.ts`:

```ts
export type Mail = {to: string; subject: string; html: string; text: string}

export interface Mailer {
  send(mail: Mail): Promise<void>
}

export const MAILER = Symbol('MAILER')
```

`memory-mailer.ts`:

```ts
import type {Mail, Mailer} from './mailer'

/** Keeps mail in memory: integration tests read codes from it; local runs without SMTP log it. */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = []

  send(mail: Mail): Promise<void> {
    this.sent.push(mail)
    if (process.env.NODE_ENV !== 'test') console.log(`[mail] to ${mail.to}: ${mail.subject}`)
    return Promise.resolve()
  }

  lastTo(email: string): Mail | undefined {
    return this.sent.findLast(m => m.to === email)
  }
}
```

`smtp-mailer.ts`:

```ts
import nodemailer from 'nodemailer'

import type {Mail, Mailer} from './mailer'

/** Plain SMTP, used against Mailpit locally and in e2e. */
export class SmtpMailer implements Mailer {
  private readonly transport: nodemailer.Transporter

  constructor(
    url: string,
    private readonly from: string
  ) {
    this.transport = nodemailer.createTransport(url)
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({from: this.from, ...mail})
  }
}
```

`resend-mailer.ts`:

```ts
import {Resend} from 'resend'

import type {Mail, Mailer} from './mailer'

export class ResendMailer implements Mailer {
  private readonly resend: Resend

  constructor(
    apiKey: string,
    private readonly from: string
  ) {
    this.resend = new Resend(apiKey)
  }

  async send(mail: Mail): Promise<void> {
    const {error} = await this.resend.emails.send({from: this.from, ...mail})
    if (error) throw new Error(`resend: ${error.message}`)
  }
}
```

`create-mailer.ts`:

```ts
import type {Mailer} from './mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

type MailEnv = Partial<Record<'RESEND_API_KEY' | 'SMTP_URL' | 'MAIL_FROM', string>>

export function createMailer(env: MailEnv): Mailer {
  const from = env.MAIL_FROM ?? 'Shop <no-reply@shop.localhost>'
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, from)
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, from)
  return new MemoryMailer()
}

let instance: Mailer | undefined
/** One mailer per process: Better Auth (built outside Nest DI) and the Nest provider share it. */
export function getMailer(): Mailer {
  instance ??= createMailer(process.env)
  return instance
}
```

`templates.tsx`:

```tsx
import {Body, Container, Heading, Html, Link, Text} from '@react-email/components'
import {render} from '@react-email/render'
import type {ReactElement} from 'react'

import type {Mail} from './mailer'

async function mail(subject: string, body: ReactElement): Promise<Omit<Mail, 'to'>> {
  return {subject, html: await render(body), text: await render(body, {plainText: true})}
}

const Layout = ({children}: {children: ReactElement | ReactElement[]}) => (
  <Html lang="en">
    <Body style={{fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff'}}>
      <Container style={{maxWidth: 480, padding: 24}}>{children}</Container>
    </Body>
  </Html>
)

export const signInCodeMail = (code: string) =>
  mail(
    `${code} is your Shop Admin sign-in code`,
    <Layout>
      <Heading as="h1">Your sign-in code</Heading>
      <Text style={{fontSize: 32, letterSpacing: 6, fontWeight: 700}}>{code}</Text>
      <Text>It expires in 5 minutes. If you did not try to sign in, ignore this email.</Text>
    </Layout>
  )

export const inviteMail = (link: string, roleName: string) =>
  mail(
    'You are invited to Shop Admin',
    <Layout>
      <Heading as="h1">You are invited</Heading>
      <Text>You were invited to Shop Admin as {roleName}. The link is valid for 7 days.</Text>
      <Link href={link}>{link}</Link>
    </Layout>
  )

export const twoFactorResetMail = () =>
  mail(
    'Your Shop Admin two-factor authentication was reset',
    <Layout>
      <Heading as="h1">Two-factor authentication reset</Heading>
      <Text>
        An owner reset your two-factor authentication. Set it up again at your next sign-in.
      </Text>
    </Layout>
  )
```

`mailer.module.ts`:

```ts
import {Global, Module} from '@nestjs/common'

import {getMailer} from './create-mailer'
import {MAILER} from './mailer'

@Global()
@Module({providers: [{provide: MAILER, useFactory: getMailer}], exports: [MAILER]})
export class MailerModule {}
```

- [ ] **Step 5: Run** — `pnpm --filter @shop/api test -- mailer` → PASS (6 tests).

- [ ] **Step 6: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): mailer with Resend, SMTP and in-memory transports"
```

---

### Task 4: Better Auth inside NestJS (spike + foundation)

**Files:**

- Create: `apps/api/src/redis/redis.module.ts`, `apps/api/src/auth/auth.ts`, `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/test/health.e2e-spec.ts` (create app with `bodyParser: false`), public controllers (`catalog`, `health`, `status`) with `@AllowAnonymous()`
- Test: `apps/api/test/auth.int-spec.ts`

**Interfaces:**

- Consumes: `getMailer()`, `signInCodeMail()` (Task 3); Prisma models (Task 2).
- Produces: `createAuth(options?: {baseURL?: string}): Auth` and `type Auth = ReturnType<typeof createAuth>`; `auth` singleton exported from `auth.ts`; `AuthModule` (ours) importing the integration's `AuthModule.forRoot({auth})`; `REDIS` token + `RedisModule` (global, ioredis from `REDIS_URL`, default `redis://localhost:6379`); `createApp()` helper in `apps/api/src/create-app.ts` used by `main.ts` and tests: `NestFactory.create(AppModule, {bodyParser: false})` + `configureApp`.

This task doubles as the spike from spec §8. Record each finding in the ledger as a ruling if it differs from the plan.

- [ ] **Step 1: Install and check module format** — `pnpm --filter @shop/api add better-auth @thallesp/nestjs-better-auth ioredis`. Then run `node -e "require('better-auth'); require('better-auth/plugins'); require('better-auth/adapters/prisma'); require('@thallesp/nestjs-better-auth'); console.log('cjs ok')"` from `apps/api`.
      Expected: `cjs ok`. If a package is ESM-only, ruling: build the instance in an async factory with `await import('better-auth')` inside `createAuth` and pass it to the integration via its async registration (check Context7 for `forRootAsync`); keep every later interface unchanged.

- [ ] **Step 2: Write the failing integration test** — `apps/api/test/auth.int-spec.ts`:

```ts
import type {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('auth in NestJS', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication

  beforeAll(async () => {
    db = await startDatabase()
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await db.stop()
  })

  it('keeps public endpoints anonymous', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200)
    await request(app.getHttpServer()).get('/api/catalog?locale=en').expect(200)
  })

  it('serves Better Auth under /api/auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/ok').expect(200)
    expect(res.body).toEqual({ok: true})
  })

  it('sends a 6-digit sign-in code through the mailer', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email: 'someone@example.com', type: 'sign-in'})
      .expect(200)
    const mail = (getMailer() as MemoryMailer).lastTo('someone@example.com')
    expect(mail?.subject).toMatch(/^\d{6} is your Shop Admin sign-in code$/)
  })
})
```

- [ ] **Step 3: Run** — `pnpm --filter @shop/api test:int -- auth.int` → FAIL: cannot find `../src/create-app`.

- [ ] **Step 4: Implement**

`apps/api/src/redis/redis.module.ts`:

```ts
import {Global, Inject, Module, type OnModuleDestroy} from '@nestjs/common'
import Redis from 'ioredis'

export const REDIS = Symbol('REDIS')

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      // lazyConnect: the app and DB-free tests boot without Redis; commands connect on first use.
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 1
        })
    }
  ],
  exports: [REDIS]
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect()
  }
}
```

`apps/api/src/auth/auth.ts`:

```ts
import {betterAuth} from 'better-auth'
import {prismaAdapter} from 'better-auth/adapters/prisma'
import {emailOTP, twoFactor} from 'better-auth/plugins'

import {getMailer} from '../mailer/create-mailer'
import {signInCodeMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'

const prisma = new PrismaService()

function socialProviders() {
  const providers: Parameters<typeof betterAuth>[0]['socialProviders'] = {}
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET
    }
  return providers
}

export function createAuth() {
  return betterAuth({
    appName: 'Shop Admin',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://admin.shop.localhost',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-secret-change-me-at-least-32-chars',
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://admin.shop.localhost'],
    database: prismaAdapter(prisma, {provider: 'postgresql'}),
    session: {expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24},
    socialProviders: socialProviders(),
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // Do not await: the response time must not reveal whether the email exists (spec §7.6).
        sendVerificationOTP: ({email, otp}) => {
          void signInCodeMail(otp)
            .then(mail => getMailer().send({to: email, ...mail}))
            .catch((error: unknown) => {
              console.error('mail: sign-in code failed', error)
            })
          return Promise.resolve()
        }
      }),
      twoFactor({issuer: 'Shop Admin', allowPasswordless: true})
    ]
  })
}

export const auth = createAuth()
export type Auth = typeof auth
```

`apps/api/src/auth/auth.module.ts`:

```ts
import {Module} from '@nestjs/common'
import {AuthModule as BetterAuthModule} from '@thallesp/nestjs-better-auth'

import {auth} from './auth'

@Module({imports: [BetterAuthModule.forRoot({auth})]})
export class AuthModule {}
```

`apps/api/src/create-app.ts`:

```ts
import type {INestApplication} from '@nestjs/common'
import {NestFactory} from '@nestjs/core'

import {AppModule} from './app.module'
import {configureApp} from './configure-app'

/** Better Auth reads the raw body, so Nest's own body parser is off (the integration parses JSON for other routes). */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {bodyParser: false})
  configureApp(app)
  return app
}
```

`apps/api/src/main.ts`:

```ts
import 'reflect-metadata'

import {createApp} from './create-app'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0')
}

void bootstrap()
```

`apps/api/src/app.module.ts`:

```ts
import {Module} from '@nestjs/common'

import {AuthModule} from './auth/auth.module'
import {CatalogModule} from './catalog/catalog.module'
import {HealthModule} from './health/health.module'
import {MailerModule} from './mailer/mailer.module'
import {PrismaModule} from './prisma/prisma.module'
import {RedisModule} from './redis/redis.module'
import {StatusModule} from './status/status.module'

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailerModule,
    AuthModule,
    HealthModule,
    StatusModule,
    CatalogModule
  ]
})
export class AppModule {}
```

Mark the public controllers anonymous (class-level): add `import {AllowAnonymous} from '@thallesp/nestjs-better-auth'` and `@AllowAnonymous()` above `@Controller(...)` in `catalog.controller.ts`, `health.controller.ts`, `status.controller.ts`.

Swap `Test.createTestingModule(...)...createNestApplication()` in `test/health.e2e-spec.ts` and `test/status.e2e-spec.ts` for `app = await createApp()` so they boot the same way production does.

- [ ] **Step 5: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS (all existing + 3 new). If `/api/docs` or the JSON 404 test breaks under `bodyParser: false`, fix in `configureApp` and ledger the ruling.

- [ ] **Step 6: JSON body check for our own routes** — add to `auth.int-spec.ts` (temporary controller registered only in the test):

```ts
it('still parses JSON bodies on non-auth routes', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/admin/invites')
    .send({email: 'x@example.com', roleId: 'r'})
  // 401 (not signed in) proves routing works; a 400 "Validation failed" with empty body would mean no parser.
  expect(res.status).toBe(401)
})
```

Run → PASS once Task 8 exists; until then expect 404 and mark this check in the ledger to re-run in Task 8.

- [ ] **Step 7: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): mount Better Auth in NestJS with email codes and TOTP"
```

---

### Task 5: Invite-only sign-up and seed

**Files:**

- Create: `apps/api/src/auth/invite-gate.ts`, `apps/api/src/team/invite-token.ts`, `apps/api/src/seed/seed-access.ts`
- Modify: `apps/api/src/auth/auth.ts` (databaseHooks), `apps/api/src/seed/main.ts`
- Test: `apps/api/src/team/invite-token.spec.ts`, `apps/api/test/invite-gate.int-spec.ts`, `apps/api/test/seed.int-spec.ts` (extend)

**Interfaces:**

- Consumes: `prisma.invite`, `prisma.role` (Task 2); `auth` (Task 4); `SYSTEM_ROLES` (Task 1); `inviteMail` (Task 3).
- Produces: `newInviteToken(): {token: string; tokenHash: string}`, `hashInviteToken(token): string`, `INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000`; `inviteGate(prisma): (user: {email: string}) => Promise<{data: {roleId: string}} | false>`; `seedAccess(prisma, mailer, adminUrl): Promise<{ownerInviteUrl: string | null}>`.

- [ ] **Step 1: Failing unit test** — `invite-token.spec.ts`:

```ts
import {hashInviteToken, newInviteToken} from './invite-token'

describe('invite token', () => {
  it('is 32 random bytes as base64url and stores only its SHA-256', () => {
    const {token, tokenHash} = newInviteToken()
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(tokenHash).toBe(hashInviteToken(token))
    expect(tokenHash).not.toContain(token)
    expect(newInviteToken().token).not.toBe(token)
  })
})
```

- [ ] **Step 2: Failing integration test** — `test/invite-gate.int-spec.ts`:

```ts
import type {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

const codeFor = (email: string) =>
  /^(\d{6})/.exec((getMailer() as MemoryMailer).lastTo(email)?.subject ?? '')?.[1] ?? ''

describe('invite-only sign-up', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
    await seedAccess(prisma, getMailer(), 'http://admin.test')
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await db.stop()
  })

  const signIn = async (email: string) => {
    const http = request(app.getHttpServer())
    await http
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email, type: 'sign-in'})
      .expect(200)
    await new Promise(resolve => setTimeout(resolve, 50)) // the mail is sent without await
    return request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .send({email, otp: codeFor(email)})
  }

  it('creates an invited user with the invite role and marks the invite accepted', async () => {
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    await prisma.invite.create({
      data: {
        email: 'ann@example.com',
        roleId: role.id,
        tokenHash: 'x1',
        expiresAt: new Date(Date.now() + 60_000)
      }
    })
    const res = await signIn('ann@example.com')
    expect(res.status).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({where: {email: 'ann@example.com'}})
    expect(user.roleId).toBe(role.id)
    const invite = await prisma.invite.findUniqueOrThrow({where: {tokenHash: 'x1'}})
    expect(invite.acceptedAt).not.toBeNull()
  })

  it('refuses an email without an invite', async () => {
    const res = await signIn('stranger@example.com')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await prisma.user.count({where: {email: 'stranger@example.com'}})).toBe(0)
  })

  it('refuses an expired or revoked invite', async () => {
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'SUPPORT'}})
    await prisma.invite.createMany({
      data: [
        {
          email: 'old@example.com',
          roleId: role.id,
          tokenHash: 'x2',
          expiresAt: new Date(Date.now() - 1)
        },
        {
          email: 'gone@example.com',
          roleId: role.id,
          tokenHash: 'x3',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date()
        }
      ]
    })
    for (const email of ['old@example.com', 'gone@example.com']) {
      expect((await signIn(email)).status).toBeGreaterThanOrEqual(400)
      expect(await prisma.user.count({where: {email}})).toBe(0)
    }
  })
})
```

Extend `test/seed.int-spec.ts`:

```ts
it('seeds the system roles and an owner invite once', async () => {
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com'
  const first = await seedAccess(prisma, mailer, 'http://admin.test')
  const second = await seedAccess(prisma, mailer, 'http://admin.test')
  expect(first.ownerInviteUrl).toMatch(/^http:\/\/admin\.test\/invite\/[\w-]{43}$/)
  expect(second.ownerInviteUrl).toBeNull() // an open owner invite already exists
  const owner = await prisma.role.findUniqueOrThrow({where: {name: 'OWNER'}})
  expect(owner.isSystem).toBe(true)
  expect(await prisma.invite.count({where: {email: 'owner@example.com'}})).toBe(1)
})
```

(`mailer` there is `new MemoryMailer()`; import `seedAccess` and `MemoryMailer`.)

- [ ] **Step 3: Run** — `pnpm --filter @shop/api test -- invite-token && pnpm --filter @shop/api test:int -- "invite-gate|seed"` → FAIL: modules not found.

- [ ] **Step 4: Implement**

`apps/api/src/team/invite-token.ts`:

```ts
import {createHash, randomBytes} from 'node:crypto'

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const hashInviteToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export function newInviteToken(): {token: string; tokenHash: string} {
  const token = randomBytes(32).toString('base64url')
  return {token, tokenHash: hashInviteToken(token)}
}
```

`apps/api/src/auth/invite-gate.ts`:

```ts
import type {PrismaService} from '../prisma/prisma.service'

/**
 * `user.create.before`: only an email with an open invite (not expired, revoked or accepted) may
 * become a user; the invite's role is assigned and the invite is marked accepted. Covers every
 * sign-in method, Google included, because they all create users through this hook.
 */
export function inviteGate(prisma: PrismaService) {
  return async (user: {email: string}): Promise<{data: {roleId: string}} | false> => {
    const invite = await prisma.invite.findFirst({
      where: {
        email: user.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {gt: new Date()}
      },
      orderBy: {createdAt: 'desc'}
    })
    if (!invite) return false
    await prisma.invite.update({where: {id: invite.id}, data: {acceptedAt: new Date()}})
    return {data: {roleId: invite.roleId}}
  }
}
```

In `auth.ts` add to the `betterAuth({...})` options (Context7: `databaseHooks.user.create.before` returning `false` aborts creation; returning `{data}` merges fields — confirm and ledger any difference):

```ts
user: {additionalFields: {roleId: {type: 'string', required: false, input: false}}},
databaseHooks: {
  user: {
    create: {
      before: async user => {
        const allowed = await inviteGate(prisma)(user)
        return allowed ? {data: {...user, ...allowed.data}} : false
      }
    }
  }
},
```

`apps/api/src/seed/seed-access.ts`:

```ts
import {SYSTEM_ROLES, type SystemRoleName} from '@shop/shared/access'

import type {Mailer} from '../mailer/mailer'
import {inviteMail} from '../mailer/templates'
import type {PrismaService} from '../prisma/prisma.service'
import {INVITE_TTL_MS, newInviteToken} from '../team/invite-token'

/** System roles, then an invite for ADMIN_OWNER_EMAIL unless that person exists or has an open invite. */
export async function seedAccess(
  prisma: PrismaService,
  mailer: Mailer,
  adminUrl: string
): Promise<{ownerInviteUrl: string | null}> {
  for (const [name, permissions] of Object.entries(SYSTEM_ROLES) as [
    SystemRoleName,
    readonly string[]
  ][]) {
    await prisma.role.upsert({
      where: {name},
      update: {isSystem: true},
      create: {name, permissions: [...permissions], isSystem: true}
    })
  }

  const email = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase()
  if (!email) return {ownerInviteUrl: null}
  const exists = await prisma.user.count({where: {email}})
  const open = await prisma.invite.count({
    where: {email, acceptedAt: null, revokedAt: null, expiresAt: {gt: new Date()}}
  })
  if (exists > 0 || open > 0) return {ownerInviteUrl: null}

  const owner = await prisma.role.findUniqueOrThrow({where: {name: 'OWNER'}})
  const {token, tokenHash} = newInviteToken()
  await prisma.invite.create({
    data: {email, roleId: owner.id, tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS)}
  })
  const ownerInviteUrl = `${adminUrl}/invite/${token}`
  await mailer.send({to: email, ...(await inviteMail(ownerInviteUrl, 'OWNER'))})
  return {ownerInviteUrl}
}
```

`apps/api/src/seed/main.ts` — after `seedCatalog(prisma)`:

```ts
import {getMailer} from '../mailer/create-mailer'
import {seedAccess} from './seed-access'

// ...
seedCatalog(prisma)
  .then(() =>
    seedAccess(prisma, getMailer(), process.env.BETTER_AUTH_URL ?? 'http://admin.shop.localhost')
  )
  .then(({ownerInviteUrl}) => {
    console.log('seed: catalog and roles ready')
    if (ownerInviteUrl) console.log(`seed: owner invite ${ownerInviteUrl}`)
  })
```

- [ ] **Step 5: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS.

- [ ] **Step 6: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api
git commit -m "feat(api): invite-only sign-up and seeded roles with an owner invite"
```

---

### Task 6: Admin session guard, permissions and TOTP stamping

**Files:**

- Create: `apps/api/src/access/permission-cache.ts`, `admin-session.guard.ts`, `require-permission.ts`, `access.module.ts`, `admin-request.ts`
- Modify: `apps/api/src/auth/auth.ts` (after-hook stamping `twoFactorVerifiedAt`), `apps/api/src/app.module.ts`
- Test: `apps/api/src/access/permission-cache.spec.ts`, `apps/api/src/access/admin-session.guard.spec.ts`, `apps/api/test/admin-session.int-spec.ts`

**Interfaces:**

- Consumes: `auth` (Task 4), `REDIS`, Prisma, `PERMISSIONS`, `hasPermission`.
- Produces:
  - `type AdminContext = {userId: string; sessionId: string; email: string; name: string; role: {id: string; name: string; isSystem: boolean}; permissions: Permission[]}` and `adminOf(req): AdminContext` (reads `req.admin`).
  - `PermissionCache` with `get(roleId): Promise<{name: string; isSystem: boolean; permissions: Permission[]}>` and `invalidate(roleId): Promise<void>`; key `perm:role:<id>`, TTL 60 s; OWNER returns every permission regardless of the table; Redis errors fall back to the database.
  - `AdminSessionGuard` (applied to every controller under `/api/admin`): reads the session via `auth.api.getSession({headers})`, 401 without one, 401 if `user.disabledAt`, 403 `{statusCode: 403, message: '2fa_required'}` if `session.twoFactorVerifiedAt` is null; else attaches `req.admin`.
  - `@RequirePermission(...perms: Permission[])` decorator + `PermissionGuard` → 403 `{message: 'forbidden'}` when any is missing.
  - `@AdminController(path)` = `Controller('admin/' + path)` + `UseGuards(AdminSessionGuard, PermissionGuard)` + integration's `@AllowAnonymous()` (our guard replaces its global one for these routes, so the 2FA rule cannot be skipped).

- [ ] **Step 1: Failing unit tests**

`permission-cache.spec.ts`:

```ts
import {PERMISSIONS} from '@shop/shared/access'

import {PermissionCache} from './permission-cache'

const role = (over = {}) => ({
  id: 'r1',
  name: 'ADMIN',
  isSystem: true,
  permissions: ['audit.read'],
  ...over
})

function setup(redisImpl: Partial<Record<'get' | 'set' | 'del', jest.Mock>> = {}) {
  const store = new Map<string, string>()
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v)
      return Promise.resolve('OK')
    }),
    del: jest.fn((k: string) => {
      store.delete(k)
      return Promise.resolve(1)
    }),
    ...redisImpl
  }
  const findUniqueOrThrow = jest.fn(() => Promise.resolve(role()))
  const cache = new PermissionCache(redis as never, {role: {findUniqueOrThrow}} as never)
  return {cache, redis, findUniqueOrThrow}
}

describe('PermissionCache', () => {
  it('reads the database once, then Redis, for 60 s', async () => {
    const {cache, redis, findUniqueOrThrow} = setup()
    await cache.get('r1')
    await cache.get('r1')
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1)
    expect(redis.set).toHaveBeenCalledWith('perm:role:r1', expect.any(String), 'EX', 60)
  })

  it('reloads after invalidation', async () => {
    const {cache, findUniqueOrThrow} = setup()
    await cache.get('r1')
    await cache.invalidate('r1')
    await cache.get('r1')
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(2)
  })

  it('gives OWNER every permission whatever the table says', async () => {
    const {cache, findUniqueOrThrow} = setup()
    findUniqueOrThrow.mockResolvedValueOnce(role({name: 'OWNER', permissions: []}))
    expect((await cache.get('r1')).permissions).toEqual([...PERMISSIONS])
  })

  it('falls back to the database when Redis is down', async () => {
    const down = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')))
    const {cache} = setup({get: down, set: down})
    expect((await cache.get('r1')).permissions).toEqual(['audit.read'])
  })
})
```

`admin-session.guard.spec.ts`:

```ts
import {ForbiddenException, UnauthorizedException} from '@nestjs/common'

import {AdminSessionGuard} from './admin-session.guard'

const ctx = (req: Record<string, unknown>) =>
  ({switchToHttp: () => ({getRequest: () => req})}) as never

function guard(session: unknown) {
  const auth = {api: {getSession: jest.fn(() => Promise.resolve(session))}}
  const cache = {
    get: jest.fn(() =>
      Promise.resolve({name: 'ADMIN', isSystem: true, permissions: ['audit.read']})
    )
  }
  const prisma = {
    user: {findUniqueOrThrow: jest.fn(() => Promise.resolve({disabledAt: null, roleId: 'r1'}))}
  }
  return {g: new AdminSessionGuard(auth as never, cache as never, prisma as never), prisma}
}

const session = (over = {}) => ({
  user: {id: 'u1', email: 'a@x.io', name: 'A'},
  session: {id: 's1', twoFactorVerifiedAt: new Date(), ...over}
})

describe('AdminSessionGuard', () => {
  it('rejects a request without a session', async () => {
    await expect(guard(null).g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })

  it('asks for TOTP when the session has not passed it', async () => {
    const err = await guard(session({twoFactorVerifiedAt: null}))
      .g.canActivate(ctx({headers: {}}))
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect((err as ForbiddenException).getResponse()).toMatchObject({message: '2fa_required'})
  })

  it('rejects a disabled admin', async () => {
    const {g, prisma} = guard(session())
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({disabledAt: new Date(), roleId: 'r1'})
    await expect(g.canActivate(ctx({headers: {}}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('attaches the admin context', async () => {
    const req: Record<string, unknown> = {headers: {}}
    await expect(guard(session()).g.canActivate(ctx(req))).resolves.toBe(true)
    expect(req.admin).toMatchObject({userId: 'u1', sessionId: 's1', permissions: ['audit.read']})
  })
})
```

- [ ] **Step 2: Failing integration test** — `test/admin-session.int-spec.ts` (needs Redis: `docker compose up -d redis`; set `REDIS_URL=redis://localhost:6379` in the test):

```ts
import type {INestApplication} from '@nestjs/common'
import {generateSync} from 'otplib'
import request from 'supertest'

import {createApp} from '../src/create-app'
import {getMailer} from '../src/mailer/create-mailer'
import type {MemoryMailer} from '../src/mailer/memory-mailer'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedAccess} from '../src/seed/seed-access'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('admin session', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
    await seedAccess(prisma, getMailer(), 'http://admin.test')
    const role = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    await prisma.invite.create({
      data: {
        email: 'ann@example.com',
        roleId: role.id,
        tokenHash: 'a',
        expiresAt: new Date(Date.now() + 60_000)
      }
    })
    app = await createApp()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await db.stop()
  })

  it('requires TOTP before any admin route, then lets the session in', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email: 'ann@example.com', type: 'sign-in'})
    await new Promise(r => setTimeout(r, 50))
    const code = /^(\d{6})/.exec(
      (getMailer() as MemoryMailer).lastTo('ann@example.com')?.subject ?? ''
    )?.[1]
    await agent
      .post('/api/auth/sign-in/email-otp')
      .send({email: 'ann@example.com', otp: code})
      .expect(200)

    const blocked = await agent.get('/api/admin/me').expect(403)
    expect(blocked.body.message).toBe('2fa_required')

    const enabled = await agent.post('/api/auth/two-factor/enable').send({}).expect(200)
    const secret = new URL(enabled.body.totpURI as string).searchParams.get('secret') ?? ''
    await agent
      .post('/api/auth/two-factor/verify-totp')
      .send({code: generateSync({secret})})
      .expect(200)

    const me = await agent.get('/api/admin/me').expect(200)
    expect(me.body).toMatchObject({email: 'ann@example.com', role: {name: 'ADMIN'}})
  })

  it('401 without a session', async () => {
    await request(app.getHttpServer()).get('/api/admin/me').expect(401)
  })
})
```

`/api/admin/me` is the smallest controller that exercises the guard; it lives in Task 8's `team` module but is created here as `apps/api/src/team/me.controller.ts`:

```ts
import {Get, Req} from '@nestjs/common'

import type {Me} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {type AdminRequest, adminOf} from '../access/admin-request'

@AdminController('me')
export class MeController {
  @Get()
  get(@Req() req: AdminRequest): Me {
    const admin = adminOf(req)
    return {
      id: admin.userId,
      email: admin.email,
      name: admin.name,
      role: {...admin.role, permissions: admin.permissions},
      permissions: admin.permissions
    }
  }
}
```

- [ ] **Step 3: Run** — `pnpm --filter @shop/api add -D otplib && pnpm --filter @shop/api test -- access && pnpm --filter @shop/api test:int -- admin-session` → FAIL: modules not found.

- [ ] **Step 4: Implement**

`admin-request.ts`:

```ts
import type {Request} from 'express'

import type {Permission} from '@shop/shared/access'

export type AdminContext = {
  userId: string
  sessionId: string
  email: string
  name: string
  role: {id: string; name: string; isSystem: boolean}
  permissions: Permission[]
}

export type AdminRequest = Request & {admin?: AdminContext}

export function adminOf(req: AdminRequest): AdminContext {
  if (!req.admin) throw new Error('adminOf() outside AdminSessionGuard')
  return req.admin
}
```

`permission-cache.ts`:

```ts
import {Inject, Injectable} from '@nestjs/common'
import type Redis from 'ioredis'
import * as v from 'valibot'

import {PERMISSIONS, type Permission, PermissionSchema} from '@shop/shared/access'

import {PrismaService} from '../prisma/prisma.service'
import {REDIS} from '../redis/redis.module'

export type CachedRole = {name: string; isSystem: boolean; permissions: Permission[]}
const TTL_S = 60
const key = (roleId: string) => `perm:role:${roleId}`

@Injectable()
export class PermissionCache {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  async get(roleId: string): Promise<CachedRole> {
    const hit = await this.redis.get(key(roleId)).catch(() => null)
    if (hit) return JSON.parse(hit) as CachedRole
    const role = await this.prisma.role.findUniqueOrThrow({where: {id: roleId}})
    const value: CachedRole = {
      name: role.name,
      isSystem: role.isSystem,
      // OWNER always holds every permission (spec decision #7); unknown strings are dropped.
      permissions:
        role.name === 'OWNER' && role.isSystem
          ? [...PERMISSIONS]
          : role.permissions.filter((p): p is Permission => v.is(PermissionSchema, p))
    }
    await this.redis.set(key(roleId), JSON.stringify(value), 'EX', TTL_S).catch(() => undefined)
    return value
  }

  async invalidate(roleId: string): Promise<void> {
    await this.redis.del(key(roleId)).catch(() => undefined)
  }
}
```

`admin-session.guard.ts`:

```ts
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import {fromNodeHeaders} from 'better-auth/node'

import {auth} from '../auth/auth'
import {PrismaService} from '../prisma/prisma.service'
import type {AdminRequest} from './admin-request'
import {PermissionCache} from './permission-cache'

type AuthApi = {api: {getSession: (o: {headers: Headers}) => Promise<unknown>}}
type SessionResult = {
  user: {id: string; email: string; name: string}
  session: {id: string; twoFactorVerifiedAt?: Date | string | null}
} | null

@Injectable()
export class AdminSessionGuard implements CanActivate {
  private readonly auth: AuthApi

  constructor(
    authOverride: AuthApi | undefined,
    private readonly cache: PermissionCache,
    private readonly prisma: PrismaService
  ) {
    this.auth = authOverride ?? (auth as unknown as AuthApi)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    const result = (await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    })) as SessionResult
    if (!result) throw new UnauthorizedException()
    const user = await this.prisma.user.findUniqueOrThrow({where: {id: result.user.id}})
    if (user.disabledAt || !user.roleId) throw new UnauthorizedException()
    if (!result.session.twoFactorVerifiedAt)
      throw new ForbiddenException({statusCode: 403, message: '2fa_required'})
    const role = await this.cache.get(user.roleId)
    req.admin = {
      userId: result.user.id,
      sessionId: result.session.id,
      email: result.user.email,
      name: result.user.name,
      role: {id: user.roleId, name: role.name, isSystem: role.isSystem},
      permissions: role.permissions
    }
    return true
  }
}
```

Register it with a factory so Nest passes `undefined` for `authOverride`:

```ts
// access.module.ts
import {Global, Module} from '@nestjs/common'

import {PrismaService} from '../prisma/prisma.service'
import {AdminSessionGuard} from './admin-session.guard'
import {PermissionCache} from './permission-cache'
import {PermissionGuard} from './require-permission'

@Global()
@Module({
  providers: [
    PermissionCache,
    PermissionGuard,
    {
      provide: AdminSessionGuard,
      inject: [PermissionCache, PrismaService],
      useFactory: (cache: PermissionCache, prisma: PrismaService) =>
        new AdminSessionGuard(undefined, cache, prisma)
    }
  ],
  exports: [PermissionCache, AdminSessionGuard, PermissionGuard]
})
export class AccessModule {}
```

`require-permission.ts`:

```ts
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata
} from '@nestjs/common'
import {Reflector} from '@nestjs/core'

import type {Permission} from '@shop/shared/access'

import {type AdminRequest, adminOf} from './admin-request'

const KEY = 'requiredPermissions'
export const RequirePermission = (...perms: Permission[]) => SetMetadata(KEY, perms)

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const needed =
      this.reflector.getAllAndOverride<Permission[] | undefined>(KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? []
    const {permissions} = adminOf(context.switchToHttp().getRequest<AdminRequest>())
    if (needed.every(p => permissions.includes(p))) return true
    throw new ForbiddenException({statusCode: 403, message: 'forbidden'})
  }
}
```

`admin-controller.ts`:

```ts
import {Controller, UseGuards, applyDecorators} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {AdminSessionGuard} from './admin-session.guard'
import {PermissionGuard} from './require-permission'

/** Every admin route: our session guard (with the TOTP rule) replaces the integration's global one. */
export const AdminController = (path: string) =>
  applyDecorators(
    Controller(`admin/${path}`),
    AllowAnonymous(),
    UseGuards(AdminSessionGuard, PermissionGuard)
  )
```

TOTP stamping — in `auth.ts` add (import `createAuthMiddleware` from `better-auth/api`):

```ts
hooks: {
  after: createAuthMiddleware(async ctx => {
    // Our 2FA rule (spec decision #5): only a TOTP or backup-code check marks this session verified.
    if (!['/two-factor/verify-totp', '/two-factor/verify-backup-code'].includes(ctx.path)) return
    const sessionId = ctx.context.newSession?.session.id ?? ctx.context.session?.session.id
    if (sessionId)
      await prisma.session.update({where: {id: sessionId}, data: {twoFactorVerifiedAt: new Date()}})
  })
},
```

Confirm via Context7 which of `ctx.context.newSession` / `ctx.context.session` is set after `verify-totp` for a passwordless session; ledger the result.

Add `AccessModule` and a `TeamModule` (`controllers: [MeController]`) to `AppModule.imports`.

- [ ] **Step 5: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS.

- [ ] **Step 6: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): admin session guard with mandatory TOTP and cached permissions"
```

---

### Task 7: Audit log

**Files:**

- Create: `apps/api/src/audit/redact.ts`, `audit.service.ts`, `audit.interceptor.ts`, `audit.controller.ts`, `audit.module.ts`
- Modify: `apps/api/src/auth/auth.ts` (auth events), `apps/api/src/access/admin-controller.ts` (add `UseInterceptors(AuditInterceptor)`)
- Test: `apps/api/src/audit/redact.spec.ts`, `apps/api/src/audit/audit.interceptor.spec.ts`, `apps/api/test/audit.int-spec.ts`

**Interfaces:**

- Consumes: `AdminRequest`/`adminOf`, `AdminController`, `RequirePermission`, `AuditQuerySchema`, `AuditPage`.
- Produces: `redact(value: unknown): unknown` (replaces values of keys `otp`, `code`, `secret`, `token`, `tokenHash`, `backupCodes`, `password`, `totpURI` with `'[redacted]'`, recursively); `AuditService.record(entry: {actorId: string | null; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; ip: string}): Promise<void>` and `page(q: AuditQuery): Promise<AuditPage>`; `@Audited(action, entityType)` decorator read by `AuditInterceptor` — mutating handlers return `{before, after, entityId}` via `AuditResult<T>` wrapper? No: handlers call `auditService.record` themselves only for before-state; the interceptor records `after` = response body. Concretely: the interceptor records for every non-GET admin request `{action: <metadata or METHOD path>, entityType, entityId: req.params.id ?? response.id, before: req.auditBefore ?? null, after: response}`; handlers that change existing rows set `req.auditBefore` first.

- [ ] **Step 1: Failing tests**

`redact.spec.ts`:

```ts
import {redact} from './redact'

describe('redact', () => {
  it('hides secrets at any depth and keeps the rest', () => {
    expect(
      redact({
        email: 'a@x.io',
        otp: '123456',
        nested: {token: 't', list: [{backupCodes: ['x']}]},
        totpURI: 'otpauth://'
      })
    ).toEqual({
      email: 'a@x.io',
      otp: '[redacted]',
      nested: {token: '[redacted]', list: [{backupCodes: '[redacted]'}]},
      totpURI: '[redacted]'
    })
  })
  it('leaves primitives alone', () => {
    expect(redact('x')).toBe('x')
    expect(redact(null)).toBeNull()
  })
})
```

`audit.interceptor.spec.ts`:

```ts
import {lastValueFrom, of} from 'rxjs'

import {AuditInterceptor} from './audit.interceptor'

const ctx = (req: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({getRequest: () => req}),
    getHandler: () => () => undefined,
    getClass: () => class {}
  }) as never

describe('AuditInterceptor', () => {
  it('records a mutating admin request with before, after and actor', async () => {
    const record = jest.fn(() => Promise.resolve())
    const reflector = {
      getAllAndOverride: jest.fn(() => ({action: 'role.update', entityType: 'role'}))
    }
    const interceptor = new AuditInterceptor({record} as never, reflector as never)
    const req = {
      method: 'PATCH',
      params: {id: 'r1'},
      ip: '1.2.3.4',
      admin: {userId: 'u1'},
      auditBefore: {name: 'Old'}
    }
    await lastValueFrom(
      interceptor.intercept(ctx(req), {handle: () => of({id: 'r1', name: 'New', token: 's'})})
    )
    expect(record).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'role.update',
      entityType: 'role',
      entityId: 'r1',
      before: {name: 'Old'},
      after: {id: 'r1', name: 'New', token: '[redacted]'},
      ip: '1.2.3.4'
    })
  })

  it('skips reads', async () => {
    const record = jest.fn()
    const interceptor = new AuditInterceptor(
      {record} as never,
      {getAllAndOverride: () => undefined} as never
    )
    await lastValueFrom(
      interceptor.intercept(ctx({method: 'GET', params: {}, admin: {userId: 'u1'}}), {
        handle: () => of({})
      })
    )
    expect(record).not.toHaveBeenCalled()
  })
})
```

`test/audit.int-spec.ts` — sign in as the seeded owner (helper `signInAdmin(app, prisma, email, roleName)` in `test/support/admin.ts`, built from the Task 6 test steps: invite → OTP → enable → verify TOTP, returns a supertest agent), then:

```ts
it('writes sign-in events and lets audit.read page through them', async () => {
  const owner = await signInAdmin(app, prisma, 'owner@example.com', 'OWNER')
  await request(app.getHttpServer())
    .post('/api/auth/sign-in/email-otp')
    .send({email: 'owner@example.com', otp: '000000'})
  const page = await owner.get('/api/admin/audit').expect(200)
  const actions = (page.body.entries as {action: string}[]).map(e => e.action)
  expect(actions).toEqual(
    expect.arrayContaining(['auth.sign_in', 'auth.sign_in_failed', 'auth.2fa_verified'])
  )
  expect(JSON.stringify(page.body)).not.toMatch(/otpauth:|"otp":"\d/)
})

it('forbids the log to a role without audit.read', async () => {
  const support = await signInAdmin(app, prisma, 'sue@example.com', 'SUPPORT')
  await support.get('/api/admin/audit').expect(403)
})
```

`test/support/admin.ts`:

```ts
import type {INestApplication} from '@nestjs/common'
import {generateSync} from 'otplib'
import request from 'supertest'

import {getMailer} from '../../src/mailer/create-mailer'
import type {MemoryMailer} from '../../src/mailer/memory-mailer'
import type {PrismaService} from '../../src/prisma/prisma.service'

/** Invite → emailed code → TOTP: returns an agent whose session passed 2FA, plus the TOTP secret. */
export async function signInAdmin(
  app: INestApplication,
  prisma: PrismaService,
  email: string,
  roleName: string
) {
  const role = await prisma.role.findUniqueOrThrow({where: {name: roleName}})
  await prisma.invite.create({
    data: {
      email,
      roleId: role.id,
      tokenHash: `t-${email}`,
      expiresAt: new Date(Date.now() + 60_000)
    }
  })
  const agent = request.agent(app.getHttpServer())
  await agent.post('/api/auth/email-otp/send-verification-otp').send({email, type: 'sign-in'})
  await new Promise(r => setTimeout(r, 50))
  const otp = /^(\d{6})/.exec((getMailer() as MemoryMailer).lastTo(email)?.subject ?? '')?.[1]
  await agent.post('/api/auth/sign-in/email-otp').send({email, otp}).expect(200)
  const enabled = await agent.post('/api/auth/two-factor/enable').send({}).expect(200)
  const secret = new URL(enabled.body.totpURI as string).searchParams.get('secret') ?? ''
  await agent
    .post('/api/auth/two-factor/verify-totp')
    .send({code: generateSync({secret})})
    .expect(200)
  return Object.assign(agent, {secret})
}
```

- [ ] **Step 2: Run** — `pnpm --filter @shop/api test -- audit && pnpm --filter @shop/api test:int -- audit` → FAIL: modules not found.

- [ ] **Step 3: Implement**

`redact.ts`:

```ts
const SECRET_KEYS = new Set([
  'otp',
  'code',
  'secret',
  'token',
  'tokenHash',
  'backupCodes',
  'password',
  'totpURI'
])

/** Audit rows must never hold credentials (plan Review Focus #5). */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.has(k) ? '[redacted]' : redact(v)])
  )
}
```

`audit.service.ts`:

```ts
import {Injectable} from '@nestjs/common'

import type {AuditPage, AuditQuery} from '@shop/shared/access'

import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {redact} from './redact'

export type AuditEntryInput = {
  actorId: string | null
  action: string
  entityType?: string
  entityId?: string
  before?: unknown
  after?: unknown
  ip: string
}

const PAGE = 50
const json = (v: unknown) =>
  v === undefined || v === null ? Prisma.DbNull : (redact(v) as Prisma.InputJsonValue)

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(e: AuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: e.actorId,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        before: json(e.before),
        after: json(e.after),
        ip: e.ip
      }
    })
  }

  async page(q: AuditQuery): Promise<AuditPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        actorId: q.actorId,
        action: q.action ? {startsWith: q.action} : undefined,
        createdAt: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined
        }
      },
      include: {actor: {select: {id: true, email: true}}},
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
      take: PAGE + 1,
      ...(q.cursor ? {cursor: {id: q.cursor}, skip: 1} : {})
    })
    const entries = rows.slice(0, PAGE).map(r => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString()
    }))
    return {entries, nextCursor: rows.length > PAGE ? (entries.at(-1)?.id ?? null) : null}
  }
}
```

`audit.interceptor.ts`:

```ts
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata
} from '@nestjs/common'
import {Reflector} from '@nestjs/core'
import {type Observable, tap} from 'rxjs'

import type {AdminRequest} from '../access/admin-request'
import {AuditService} from './audit.service'

type Meta = {action: string; entityType: string}
const KEY = 'audit'
/** Names the audit action of a mutating admin handler, e.g. `@Audited('role.update', 'role')`. */
export const Audited = (action: string, entityType: string) =>
  SetMetadata(KEY, {action, entityType} satisfies Meta)

export type AuditableRequest = AdminRequest & {auditBefore?: unknown}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditableRequest>()
    if (req.method === 'GET') return next.handle()
    const meta = this.reflector.getAllAndOverride<Meta | undefined>(KEY, [
      context.getHandler(),
      context.getClass()
    ])
    return next.handle().pipe(
      tap(body => {
        const id = req.params.id ?? (body as {id?: string} | null)?.id
        void this.audit.record({
          actorId: req.admin?.userId ?? null,
          action: meta?.action ?? `${req.method.toLowerCase()} ${req.path}`,
          entityType: meta?.entityType,
          entityId: id,
          before: req.auditBefore,
          after: body,
          ip: req.ip ?? ''
        })
      })
    )
  }
}
```

(The unit test expects `after` redacted: `AuditService.record` redacts, but the test mocks `record`. Pass `redact(body)` from the interceptor instead and keep `record` redacting too — redaction is idempotent.)

`audit.controller.ts`:

```ts
import {Get, Query} from '@nestjs/common'

import {type AuditPage, type AuditQuery, AuditQuerySchema} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {ValibotPipe} from '../common/valibot.pipe'
import {AuditService} from './audit.service'

@AdminController('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@Query(new ValibotPipe(AuditQuerySchema)) q: AuditQuery): Promise<AuditPage> {
    return this.audit.page(q)
  }
}
```

`audit.module.ts`: `@Global() @Module({providers: [AuditService, AuditInterceptor], controllers: [AuditController], exports: [AuditService, AuditInterceptor]})`. Add `UseInterceptors(AuditInterceptor)` to `AdminController`'s `applyDecorators`.

Auth events — in `auth.ts` extend the `after` hook (module-level `const audit = new AuditService(prisma)`):

```ts
const ip = ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
if (ctx.path === '/sign-in/email-otp' || ctx.path.startsWith('/callback/')) {
  const userId = ctx.context.newSession?.user.id ?? null
  await audit.record({
    actorId: userId,
    action: userId ? 'auth.sign_in' : 'auth.sign_in_failed',
    after: {email: ctx.body?.email ?? null, method: ctx.path},
    ip
  })
}
if (ctx.path === '/two-factor/verify-totp' || ctx.path === '/two-factor/verify-backup-code')
  await audit.record({
    actorId: ctx.context.session?.user.id ?? null,
    action: 'auth.2fa_verified',
    ip
  })
```

If a failed `/sign-in/email-otp` throws before `after` hooks run (Context7: check `hooks.after` on error responses), record failures in a `before` hook that re-checks nothing but wraps: ledger the approach that works.

- [ ] **Step 4: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api
git commit -m "feat(api): audit log of admin changes and sign-in events"
```

---

### Task 8: Team API (admins, invites, roles) and OpenAPI

**Files:**

- Create: `apps/api/src/team/admins.controller.ts`, `admins.service.ts`, `invites.controller.ts`, `invites.service.ts`, `roles.controller.ts`, `roles.service.ts`, `team.module.ts` (absorbs `MeController`), `invite-lookup.controller.ts`
- Modify: `apps/api/src/openapi/openapi.ts` (paths for all admin routes; operation shape with `requestBody` and path params), `apps/api/openapi.json` (regenerate)
- Test: `apps/api/test/team.int-spec.ts`, `apps/api/src/openapi/openapi.spec.ts` (extend)

**Interfaces:**

- Consumes: everything above; `twoFactorResetMail`, `inviteMail`, `newInviteToken`, `INVITE_TTL_MS`, `PermissionCache.invalidate`, `Audited`.
- Produces endpoints (all under `/api/admin`, JSON, guarded):

| Method | Path                    | Permission     | Body / result                                                       |
| ------ | ----------------------- | -------------- | ------------------------------------------------------------------- |
| GET    | `/me`                   | —              | `Me`                                                                |
| GET    | `/admins`               | `admin.invite` | `Admin[]`                                                           |
| PATCH  | `/admins/:id/role`      | `role.write`   | `ChangeRole` → `Admin`; ends that user's sessions                   |
| POST   | `/admins/:id/reset-2fa` | `admin.invite` | → `Admin`; deletes `twoFactor` rows, ends sessions, mails           |
| DELETE | `/admins/:id`           | `admin.invite` | → `Admin` with `disabledAt`; ends sessions                          |
| GET    | `/invites`              | `admin.invite` | `Invite[]` (open first)                                             |
| POST   | `/invites`              | `admin.invite` | `CreateInvite` → `Invite`; mails the link                           |
| POST   | `/invites/:id/resend`   | `admin.invite` | → `Invite` with a fresh token and expiry                            |
| DELETE | `/invites/:id`          | `admin.invite` | → `Invite` with `revokedAt`                                         |
| GET    | `/roles`                | —              | `Role[]`                                                            |
| POST   | `/roles`                | `role.write`   | `RoleInput` → `Role`                                                |
| PATCH  | `/roles/:id`            | `role.write`   | `RoleInput` → `Role`; invalidates cache, ends sessions of its users |
| DELETE | `/roles/:id`            | `role.write`   | 204; 409 if users or open invites use it                            |

Plus anonymous `GET /api/invite-lookup/:token` → `InviteLookup` (status only; no role) for the invite page.

- Rules (400 `{message: 'owner_protected'}`): any change to the user whose role is system `OWNER` (role change, reset-2fa, delete) unless the actor is that same owner resetting their own 2FA; any `PATCH`/`DELETE` of a system role; assigning the `OWNER` role through `PATCH /admins/:id/role` or an invite.

- [ ] **Step 1: Failing integration test** — `test/team.int-spec.ts` (uses `signInAdmin` from Task 7):

```ts
it('invites a person, mails the link and lists the invite', async () => {
  const owner = await signInAdmin(app, prisma, 'owner@example.com', 'OWNER')
  const admin = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
  const res = await owner
    .post('/api/admin/invites')
    .send({email: 'New@Example.com', roleId: admin.id})
    .expect(201)
  expect(res.body).toMatchObject({
    email: 'new@example.com',
    role: {name: 'ADMIN'},
    acceptedAt: null
  })
  const mail = (getMailer() as MemoryMailer).lastTo('new@example.com')
  const token = /invite\/([\w-]{43})/.exec(mail?.text ?? '')?.[1] ?? ''
  const lookup = await request(app.getHttpServer()).get(`/api/invite-lookup/${token}`).expect(200)
  expect(lookup.body).toEqual({email: 'new@example.com', status: 'valid'})
})

it('refuses to invite anyone as OWNER', async () => {
  const owner = await signInAdmin(app, prisma, 'o2@example.com', 'OWNER')
  const ownerRole = await prisma.role.findUniqueOrThrow({where: {name: 'OWNER'}})
  await owner
    .post('/api/admin/invites')
    .send({email: 'x@example.com', roleId: ownerRole.id})
    .expect(400)
})

it('changing a role ends that person’s sessions', async () => {
  const owner = await signInAdmin(app, prisma, 'o3@example.com', 'OWNER')
  const ann = await signInAdmin(app, prisma, 'ann@example.com', 'ADMIN')
  await ann.get('/api/admin/me').expect(200)
  const annUser = await prisma.user.findUniqueOrThrow({where: {email: 'ann@example.com'}})
  const support = await prisma.role.findUniqueOrThrow({where: {name: 'SUPPORT'}})
  await owner.patch(`/api/admin/admins/${annUser.id}/role`).send({roleId: support.id}).expect(200)
  await ann.get('/api/admin/me').expect(401)
})

it('protects the owner and system roles', async () => {
  const owner = await signInAdmin(app, prisma, 'o4@example.com', 'OWNER')
  const ann = await signInAdmin(app, prisma, 'ann2@example.com', 'ADMIN')
  const ownerUser = await prisma.user.findUniqueOrThrow({where: {email: 'o4@example.com'}})
  await ann.delete(`/api/admin/admins/${ownerUser.id}`).expect(400)
  await ann.post(`/api/admin/admins/${ownerUser.id}/reset-2fa`).expect(400)
  const system = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
  await owner
    .patch(`/api/admin/roles/${system.id}`)
    .send({name: 'ADMIN', permissions: []})
    .expect(400)
  await owner.delete(`/api/admin/roles/${system.id}`).expect(400)
})

it('a permission change applies to the next request', async () => {
  const owner = await signInAdmin(app, prisma, 'o5@example.com', 'OWNER')
  const editor = await owner
    .post('/api/admin/roles')
    .send({name: 'Auditor', permissions: ['audit.read']})
    .expect(201)
  const bob = await signInAdmin(app, prisma, 'bob@example.com', 'Auditor')
  await bob.get('/api/admin/audit').expect(200)
  await owner
    .patch(`/api/admin/roles/${editor.body.id as string}`)
    .send({name: 'Auditor', permissions: []})
    .expect(200)
  // Sessions of the role's users end on change (spec): bob must sign in again.
  await bob.get('/api/admin/audit').expect(401)
})

it('removing an admin disables, keeps the row and signs them out', async () => {
  const owner = await signInAdmin(app, prisma, 'o6@example.com', 'OWNER')
  const cat = await signInAdmin(app, prisma, 'cat@example.com', 'SUPPORT')
  const user = await prisma.user.findUniqueOrThrow({where: {email: 'cat@example.com'}})
  const res = await owner.delete(`/api/admin/admins/${user.id}`).expect(200)
  expect(res.body.disabledAt).not.toBeNull()
  await cat.get('/api/admin/me').expect(401)
})
```

Re-enable the Task 4 Step 6 JSON check (`POST /api/admin/invites` unauthenticated → 401).

Extend `openapi.spec.ts`:

```ts
it('documents every admin route', () => {
  const doc = buildOpenApiDocument()
  expect(Object.keys(doc.paths)).toEqual(
    expect.arrayContaining([
      '/api/admin/me',
      '/api/admin/admins',
      '/api/admin/admins/{id}/role',
      '/api/admin/invites',
      '/api/admin/roles/{id}',
      '/api/admin/audit',
      '/api/invite-lookup/{token}'
    ])
  )
})
```

- [ ] **Step 2: Run** — `pnpm --filter @shop/api test -- openapi && pnpm --filter @shop/api test:int -- team` → FAIL.

- [ ] **Step 3: Implement services and controllers.** Representative code; every service method is in this shape (`req.auditBefore` set before a change, `owner_protected` checks first, sessions deleted with `prisma.session.deleteMany({where: {userId}})`, cache invalidated with `PermissionCache.invalidate(roleId)`):

`admins.service.ts`:

```ts
import {BadRequestException, Inject, Injectable} from '@nestjs/common'

import type {Admin} from '@shop/shared/access'

import type {Mailer} from '../mailer/mailer'
import {MAILER} from '../mailer/mailer'
import {twoFactorResetMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'

const OWNER_PROTECTED = new BadRequestException({statusCode: 400, message: 'owner_protected'})

type UserWithRole = {
  id: string
  email: string
  name: string
  twoFactorEnabled: boolean
  disabledAt: Date | null
  role: {id: string; name: string; isSystem: boolean} | null
}

export const toAdmin = (u: UserWithRole): Admin => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: {id: u.role?.id ?? '', name: u.role?.name ?? ''},
  twoFactorEnabled: u.twoFactorEnabled,
  disabledAt: u.disabledAt?.toISOString() ?? null
})

const isOwner = (u: UserWithRole) => u.role?.name === 'OWNER' && u.role.isSystem

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer
  ) {}

  private find(id: string) {
    return this.prisma.user.findUniqueOrThrow({where: {id}, include: {role: true}})
  }

  async list(): Promise<Admin[]> {
    const users = await this.prisma.user.findMany({
      include: {role: true},
      orderBy: {createdAt: 'asc'}
    })
    return users.map(toAdmin)
  }

  async changeRole(id: string, roleId: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    const target = await this.prisma.role.findUniqueOrThrow({where: {id: roleId}})
    if (isOwner(user) || (target.name === 'OWNER' && target.isSystem)) throw OWNER_PROTECTED
    before(toAdmin(user))
    const [, updated] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({where: {id}, data: {roleId}, include: {role: true}})
    ])
    return toAdmin(updated)
  }

  async resetTwoFactor(id: string, actorId: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    if (isOwner(user) && actorId !== id) throw OWNER_PROTECTED
    before(toAdmin(user))
    const [, , updated] = await this.prisma.$transaction([
      this.prisma.twoFactor.deleteMany({where: {userId: id}}),
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({where: {id}, data: {twoFactorEnabled: false}, include: {role: true}})
    ])
    await this.mailer.send({to: user.email, ...(await twoFactorResetMail())})
    return toAdmin(updated)
  }

  async disable(id: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    if (isOwner(user)) throw OWNER_PROTECTED
    before(toAdmin(user))
    const [, updated] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({where: {id}, data: {disabledAt: new Date()}, include: {role: true}})
    ])
    return toAdmin(updated)
  }
}
```

`admins.controller.ts`:

```ts
import {Body, Delete, Get, Param, Patch, Post, Req} from '@nestjs/common'

import {type Admin, type ChangeRole, ChangeRoleSchema} from '@shop/shared/access'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {AdminsService} from './admins.service'

@AdminController('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @RequirePermission('admin.invite')
  list(): Promise<Admin[]> {
    return this.admins.list()
  }

  @Patch(':id/role')
  @RequirePermission('role.write')
  @Audited('admin.role_change', 'user')
  changeRole(
    @Param('id') id: string,
    @Body(new ValibotPipe(ChangeRoleSchema)) body: ChangeRole,
    @Req() req: AuditableRequest
  ): Promise<Admin> {
    return this.admins.changeRole(id, body.roleId, b => (req.auditBefore = b))
  }

  @Post(':id/reset-2fa')
  @RequirePermission('admin.invite')
  @Audited('admin.2fa_reset', 'user')
  resetTwoFactor(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Admin> {
    return this.admins.resetTwoFactor(id, adminOf(req).userId, b => (req.auditBefore = b))
  }

  @Delete(':id')
  @RequirePermission('admin.invite')
  @Audited('admin.remove', 'user')
  remove(@Param('id') id: string, @Req() req: AuditableRequest): Promise<Admin> {
    return this.admins.disable(id, b => (req.auditBefore = b))
  }
}
```

`invites.service.ts` (create, list, resend, revoke, lookup):

```ts
import {BadRequestException, Inject, Injectable} from '@nestjs/common'

import type {CreateInvite, Invite, InviteLookup} from '@shop/shared/access'

import type {Mailer} from '../mailer/mailer'
import {MAILER} from '../mailer/mailer'
import {inviteMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'
import {INVITE_TTL_MS, hashInviteToken, newInviteToken} from './invite-token'

type Row = {
  id: string
  email: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  role: {id: string; name: string}
}
export const toInvite = (r: Row): Invite => ({
  id: r.id,
  email: r.email,
  role: {id: r.role.id, name: r.role.name},
  expiresAt: r.expiresAt.toISOString(),
  acceptedAt: r.acceptedAt?.toISOString() ?? null,
  revokedAt: r.revokedAt?.toISOString() ?? null
})

const adminUrl = () => process.env.BETTER_AUTH_URL ?? 'http://admin.shop.localhost'

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer
  ) {}

  async list(): Promise<Invite[]> {
    const rows = await this.prisma.invite.findMany({
      include: {role: true},
      orderBy: [{acceptedAt: {sort: 'asc', nulls: 'first'}}, {createdAt: 'desc'}]
    })
    return rows.map(toInvite)
  }

  async create(input: CreateInvite, invitedById: string): Promise<Invite> {
    const role = await this.prisma.role.findUniqueOrThrow({where: {id: input.roleId}})
    if (role.name === 'OWNER' && role.isSystem)
      throw new BadRequestException({statusCode: 400, message: 'owner_protected'})
    const {token, tokenHash} = newInviteToken()
    const row = await this.prisma.invite.create({
      data: {
        email: input.email,
        roleId: role.id,
        tokenHash,
        invitedById,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS)
      },
      include: {role: true}
    })
    await this.send(row.email, token, role.name)
    return toInvite(row)
  }

  async resend(id: string): Promise<Invite> {
    const {token, tokenHash} = newInviteToken()
    const row = await this.prisma.invite.update({
      where: {id, acceptedAt: null, revokedAt: null},
      data: {tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS)},
      include: {role: true}
    })
    await this.send(row.email, token, row.role.name)
    return toInvite(row)
  }

  async revoke(id: string): Promise<Invite> {
    const row = await this.prisma.invite.update({
      where: {id},
      data: {revokedAt: new Date()},
      include: {role: true}
    })
    return toInvite(row)
  }

  async lookup(token: string): Promise<InviteLookup | null> {
    const row = await this.prisma.invite.findUnique({where: {tokenHash: hashInviteToken(token)}})
    if (!row) return null
    const status = row.revokedAt
      ? 'revoked'
      : row.acceptedAt
        ? 'used'
        : row.expiresAt < new Date()
          ? 'expired'
          : 'valid'
    return {email: row.email, status}
  }

  private async send(email: string, token: string, roleName: string) {
    await this.mailer.send({
      to: email,
      ...(await inviteMail(`${adminUrl()}/invite/${token}`, roleName))
    })
  }
}
```

`invites.controller.ts` mirrors `AdminsController` (GET list, POST create with `@Body(new ValibotPipe(CreateInviteSchema))` and `adminOf(req).userId`, `POST :id/resend`, `DELETE :id`), each `@RequirePermission('admin.invite')` and `@Audited('invite.create' | 'invite.resend' | 'invite.revoke', 'invite')`.

`invite-lookup.controller.ts`:

```ts
import {Controller, Get, NotFoundException, Param} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import type {InviteLookup} from '@shop/shared/access'

import {InvitesService} from './invites.service'

@AllowAnonymous()
@Controller('invite-lookup')
export class InviteLookupController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  async get(@Param('token') token: string): Promise<InviteLookup> {
    const found = await this.invites.lookup(token)
    if (!found) throw new NotFoundException()
    return found
  }
}
```

`roles.service.ts`:

```ts
import {BadRequestException, ConflictException, Injectable} from '@nestjs/common'

import type {Role, RoleInput} from '@shop/shared/access'

import {PermissionCache} from '../access/permission-cache'
import {PrismaService} from '../prisma/prisma.service'

const SYSTEM = new BadRequestException({statusCode: 400, message: 'owner_protected'})

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCache
  ) {}

  private async toRole(id: string): Promise<Role> {
    const r = await this.prisma.role.findUniqueOrThrow({where: {id}})
    return {
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      permissions: (await this.cache.get(r.id)).permissions
    }
  }

  async list(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({orderBy: [{isSystem: 'desc'}, {name: 'asc'}]})
    return Promise.all(rows.map(r => this.toRole(r.id)))
  }

  async create(input: RoleInput): Promise<Role> {
    const r = await this.prisma.role.create({
      data: {name: input.name, permissions: input.permissions}
    })
    return this.toRole(r.id)
  }

  async update(id: string, input: RoleInput, before: (r: Role) => void): Promise<Role> {
    const current = await this.prisma.role.findUniqueOrThrow({where: {id}})
    if (current.isSystem) throw SYSTEM
    before(await this.toRole(id))
    await this.prisma.$transaction([
      this.prisma.role.update({
        where: {id},
        data: {name: input.name, permissions: input.permissions}
      }),
      this.prisma.session.deleteMany({where: {user: {roleId: id}}})
    ])
    await this.cache.invalidate(id)
    return this.toRole(id)
  }

  async remove(id: string): Promise<void> {
    const current = await this.prisma.role.findUniqueOrThrow({where: {id}})
    if (current.isSystem) throw SYSTEM
    const inUse =
      (await this.prisma.user.count({where: {roleId: id}})) +
      (await this.prisma.invite.count({where: {roleId: id, acceptedAt: null, revokedAt: null}}))
    if (inUse > 0) throw new ConflictException({statusCode: 409, message: 'role_in_use'})
    await this.prisma.role.delete({where: {id}})
    await this.cache.invalidate(id)
  }
}
```

`roles.controller.ts`: `GET` (no permission), `POST` (`role.write`, `@Audited('role.create','role')`, `ValibotPipe(RoleInputSchema)`), `PATCH :id` (`role.write`, `@Audited('role.update','role')`), `DELETE :id` (`role.write`, `@Audited('role.delete','role')`, `@HttpCode(204)`).

`team.module.ts`: `controllers: [MeController, AdminsController, InvitesController, InviteLookupController, RolesController]`, `providers: [AdminsService, InvitesService, RolesService]`.

OpenAPI — widen the document type and add paths. Replace the `OpenApiDocument` type with:

```ts
type Operation = {
  summary: string
  parameters?: {name: string; in: 'query' | 'path'; required: boolean; schema: JsonSchema}[]
  requestBody?: {required: true; content: {'application/json': {schema: JsonSchema}}}
  responses: Record<string, {description: string; content?: Record<string, {schema: JsonSchema}>}>
}
export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {title: string; version: string}
  paths: Record<string, Partial<Record<'get' | 'post' | 'patch' | 'delete', Operation>>>
}
```

and helpers `json(s)`, `body(s)`, `pathId`, then one entry per row of the endpoints table above, using the schemas from `@shop/shared/access` (`v.array(AdminSchema)` etc.). Regenerate: `pnpm --filter @shop/api openapi`.

- [ ] **Step 4: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS; `git diff --stat apps/api/openapi.json` shows the new paths.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api
git commit -m "feat(api): team API for admins, invites and roles"
```

---

### Task 9: Rate limits

**Files:**

- Create: `apps/api/src/throttle/throttle.module.ts`, `apps/api/src/auth/otp-limit.ts`
- Modify: `apps/api/src/auth/auth.ts` (Better Auth `rateLimit` + per-email OTP limit), `apps/api/src/app.module.ts`, `apps/api/src/access/admin-controller.ts` (`@Throttle({admin: {limit: 300, ttl: 60_000}})`)
- Test: `apps/api/src/auth/otp-limit.spec.ts`, `apps/api/test/rate-limit.int-spec.ts`

**Interfaces:**

- Produces: `otpAllowed(redis, email, ip): Promise<boolean>` — at most 3 sends per email per 10 min and 10 per IP per hour (Redis `INCR` + `EXPIRE` on keys `otp:email:<email>` / `otp:ip:<ip>`); when Redis fails it returns `false` (fail closed, spec §7.7). `ThrottleModule` registering `@nestjs/throttler` with `@nest-lab/throttler-storage-redis`, default 100 / 60 s per IP, named throttler `admin` 300 / 60 s keyed by session cookie.

- [ ] **Step 1: Failing tests**

`otp-limit.spec.ts`:

```ts
import {otpAllowed} from './otp-limit'

function fakeRedis() {
  const counts = new Map<string, number>()
  return {
    incr: jest.fn((k: string) => {
      counts.set(k, (counts.get(k) ?? 0) + 1)
      return Promise.resolve(counts.get(k))
    }),
    expire: jest.fn(() => Promise.resolve(1))
  }
}

describe('otpAllowed', () => {
  it('allows 3 codes per email in 10 minutes', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 4; i++) results.push(await otpAllowed(redis as never, 'a@x.io', '1.1.1.1'))
    expect(results).toEqual([true, true, true, false])
    expect(redis.expire).toHaveBeenCalledWith('otp:email:a@x.io', 600)
  })

  it('allows 10 per IP per hour across emails', async () => {
    const redis = fakeRedis()
    const results = []
    for (let i = 0; i < 11; i++)
      results.push(await otpAllowed(redis as never, `u${String(i)}@x.io`, '2.2.2.2'))
    expect(results.at(-1)).toBe(false)
    expect(results.slice(0, 10).every(Boolean)).toBe(true)
  })

  it('fails closed when Redis is down', async () => {
    const down = {incr: () => Promise.reject(new Error('down')), expire: () => Promise.resolve(0)}
    expect(await otpAllowed(down as never, 'a@x.io', '1.1.1.1')).toBe(false)
  })
})
```

`test/rate-limit.int-spec.ts`:

```ts
it('stops the fourth code request for one email but answers 200 every time', async () => {
  const http = () =>
    request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .send({email: 'flood@example.com', type: 'sign-in'})
  for (let i = 0; i < 4; i++) await http().expect(200) // no enumeration: same answer
  await new Promise(r => setTimeout(r, 50))
  expect((getMailer() as MemoryMailer).sent.filter(m => m.to === 'flood@example.com')).toHaveLength(
    3
  )
})
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `pnpm --filter @shop/api add @nestjs/throttler @nest-lab/throttler-storage-redis`.

`otp-limit.ts`:

```ts
import type Redis from 'ioredis'

async function under(
  redis: Pick<Redis, 'incr' | 'expire'>,
  key: string,
  max: number,
  ttlS: number
) {
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, ttlS)
  return n <= max
}

/** Send-OTP limits from parent spec §7.5. Fails closed: no Redis, no code. */
export async function otpAllowed(
  redis: Pick<Redis, 'incr' | 'expire'>,
  email: string,
  ip: string
): Promise<boolean> {
  try {
    const byEmail = await under(redis, `otp:email:${email.toLowerCase()}`, 3, 600)
    const byIp = await under(redis, `otp:ip:${ip}`, 10, 3600)
    return byEmail && byIp
  } catch {
    return false
  }
}
```

In `auth.ts`, inside `sendVerificationOTP` (it receives `ctx` as second argument; IP from `ctx?.request?.headers.get('x-forwarded-for')`): `if (!(await otpAllowed(redis, email, ip))) return` before sending — the endpoint still answers 200. Create the module-level Redis client in `auth.ts` the same way as `RedisModule` (`lazyConnect`). Also set Better Auth `rateLimit: {enabled: true, storage: 'database', window: 60, max: 100}`.

`throttle.module.ts`:

```ts
import {ThrottlerStorageRedisService} from '@nest-lab/throttler-storage-redis'
import {Module} from '@nestjs/common'
import {APP_GUARD} from '@nestjs/core'
import {ThrottlerGuard, ThrottlerModule} from '@nestjs/throttler'

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {name: 'default', ttl: 60_000, limit: 100},
        {name: 'admin', ttl: 60_000, limit: 300}
      ],
      storage: new ThrottlerStorageRedisService(process.env.REDIS_URL ?? 'redis://localhost:6379')
    })
  ],
  providers: [{provide: APP_GUARD, useClass: ThrottlerGuard}]
})
export class ThrottleModule {}
```

Admin routes skip `default` and use `admin` keyed by session: in `admin-controller.ts` add `SkipThrottle({default: true})` and `Throttle({admin: {limit: 300, ttl: 60_000}})`; public controllers get `SkipThrottle({admin: true})`. Keying the admin throttler by session cookie: subclass `ThrottlerGuard` (`getTracker(req)` returns the `better-auth.session_token` cookie value or `req.ip`) — confirm the cookie name with Context7 and ledger it.

- [ ] **Step 4: Run** — `pnpm --filter @shop/api test && pnpm --filter @shop/api test:int` → PASS.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @shop/api test:int
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): rate limits for sign-in codes and admin API"
```

---

### Task 10: Admin app foundation (auth client, API client, session gate, shell)

**Files:**

- Create: `apps/admin/src/lib/auth-client.ts`, `apps/admin/src/lib/session.ts`, `apps/admin/src/lib/api/base.ts`, `apps/admin/src/lib/api/store.ts`, `apps/admin/src/lib/api/generated.ts` (codegen output), `apps/admin/openapi-config.ts`, `apps/admin/src/app/providers.tsx`, `apps/admin/src/app/(shell)/layout.tsx`, `apps/admin/src/app/(shell)/page.tsx`, `apps/admin/src/app/(shell)/_components/nav.tsx`, `apps/admin/src/config/nav.ts`
- Modify: `apps/admin/package.json`, `apps/admin/next.config.ts` (dev rewrites `/api/*` → API, like `apps/web`), `apps/admin/src/app/layout.tsx` (providers), delete `apps/admin/src/app/page.tsx` + `page.test.tsx`
- Test: `apps/admin/src/lib/session.test.ts`, `apps/admin/src/app/(shell)/_components/nav.test.tsx`

**Interfaces:**

- Consumes: `/api/admin/me` (`Me`), `openapi.json`, `hasPermission`, `Permission`.
- Produces: `authClient` (`createAuthClient({basePath: '/api/auth', plugins: [emailOTPClient(), twoFactorClient()]})`); `getMe(): Promise<{state: 'ok'; me: Me} | {state: 'signed-out'} | {state: '2fa'}>` (server-only; forwards request cookies to `${API_ORIGIN}/api/admin/me`); `requireMe(): Promise<Me>` (redirects to `/login` or `/2fa`); generated hooks `useGetAdminsQuery`, `useCreateInviteMutation`, ... (names from codegen; Tasks 11–12 use them); `NAV: {href: string; label: string; permission?: Permission}[]`; `<Nav me={me} />`.

- [ ] **Step 1: Install** — `pnpm --filter @shop/admin add better-auth @reduxjs/toolkit react-redux @shop/shared react-hook-form @hookform/resolvers valibot qrcode.react && pnpm --filter @shop/admin add -D @rtk-query/codegen-openapi tsx`.

- [ ] **Step 2: Failing tests**

`session.test.ts`:

```ts
import {getMe} from './session'

jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({toString: () => 'better-auth.session_token=abc'})
}))

const me = {
  id: 'u1',
  email: 'a@x.io',
  name: 'A',
  role: {id: 'r', name: 'ADMIN', isSystem: true, permissions: []},
  permissions: []
}

describe('getMe', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('forwards the cookies and returns the admin', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(me), {status: 200}))
    await expect(getMe()).resolves.toEqual({state: 'ok', me})
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {cookie: 'better-auth.session_token=abc'},
      cache: 'no-store'
    })
  })

  it('reports a missing session and a pending 2FA', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', {status: 401}))
    await expect(getMe()).resolves.toEqual({state: 'signed-out'})
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({message: '2fa_required'}), {status: 403}))
    await expect(getMe()).resolves.toEqual({state: '2fa'})
  })
})
```

`nav.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react'

import {Nav} from './nav'

jest.mock('next/navigation', () => ({usePathname: () => '/team'}))

const me = (permissions: string[]) =>
  ({
    id: 'u',
    email: 'a@x.io',
    name: 'A',
    role: {id: 'r', name: 'X', isSystem: false, permissions},
    permissions
  }) as never

describe('Nav', () => {
  it('shows only sections the admin may open', () => {
    render(<Nav me={me(['admin.invite'])} />)
    expect(screen.getByRole('link', {name: 'Team'})).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', {name: 'Audit log'})).not.toBeInTheDocument()
  })
  it('shows the audit log with audit.read', () => {
    render(<Nav me={me(['audit.read'])} />)
    expect(screen.getByRole('link', {name: 'Audit log'})).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run** — `pnpm --filter @shop/admin test` → FAIL (modules not found).

- [ ] **Step 4: Implement**

`src/lib/session.ts`:

```ts
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import 'server-only'

import type {Me} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export type MeState = {state: 'ok'; me: Me} | {state: 'signed-out'} | {state: '2fa'}

/** The signed-in admin, read with the visitor's cookies (the API owns the session). */
export async function getMe(): Promise<MeState> {
  const cookie = (await cookies()).toString()
  const res = await fetch(`${API_ORIGIN}/api/admin/me`, {
    headers: {cookie},
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  })
  if (res.ok) return {state: 'ok', me: (await res.json()) as Me}
  if (res.status === 403) return {state: '2fa'}
  return {state: 'signed-out'}
}

export async function requireMe(): Promise<Me> {
  const result = await getMe()
  if (result.state === 'signed-out') redirect('/login')
  if (result.state === '2fa') redirect('/2fa')
  return result.me
}
```

(`server-only` is a Next dependency; add it explicitly if the import fails: `pnpm --filter @shop/admin add server-only`. In jest map it to an empty module: `moduleNameMapper: {'^server-only$': '<rootDir>/src/test/empty.ts'}`.)

`src/lib/auth-client.ts`:

```ts
import {emailOTPClient, twoFactorClient} from 'better-auth/client/plugins'
import {createAuthClient} from 'better-auth/react'

/** Same-origin: the admin host routes /api/* to the API (Traefik; dev rewrites). */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [emailOTPClient(), twoFactorClient()]
})
```

`src/lib/api/base.ts`:

```ts
import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

/** Generated endpoints are injected into this API (openapi-config.ts). */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({baseUrl: '/', credentials: 'same-origin'}),
  endpoints: () => ({})
})
```

`openapi-config.ts`:

```ts
import type {ConfigFile} from '@rtk-query/codegen-openapi'

const config: ConfigFile = {
  schemaFile: '../api/openapi.json',
  apiFile: './src/lib/api/base.ts',
  apiImport: 'baseApi',
  outputFile: './src/lib/api/generated.ts',
  exportName: 'api',
  hooks: true,
  filterEndpoints: [/admin/, /invite/]
}

export default config
```

Add script `"codegen": "rtk-query-codegen-openapi openapi-config.ts"` to `apps/admin/package.json`, run `pnpm --filter @shop/admin codegen`, commit `generated.ts`. Add to CI? The API test `openapi.spec` already guards `openapi.json`; add a quality step `pnpm --filter @shop/admin codegen && git diff --exit-code apps/admin/src/lib/api/generated.ts` to `.github/workflows/ci.yml`.

`src/lib/api/store.ts`:

```ts
import {configureStore} from '@reduxjs/toolkit'

import {api} from './generated'

export const makeStore = () =>
  configureStore({
    reducer: {[api.reducerPath]: api.reducer},
    middleware: d => d().concat(api.middleware)
  })
```

`src/app/providers.tsx`:

```tsx
'use client'

import {makeStore} from '@/lib/api/store'
import {type ReactNode, useState} from 'react'
import {Provider} from 'react-redux'

export function Providers({children}: {children: ReactNode}) {
  const [store] = useState(makeStore)
  return <Provider store={store}>{children}</Provider>
}
```

`src/config/nav.ts`:

```ts
import type {Permission} from '@shop/shared/access'

export const NAV: {href: string; label: string; permission?: Permission}[] = [
  {href: '/', label: 'Home'},
  {href: '/team', label: 'Team', permission: 'admin.invite'},
  {href: '/audit', label: 'Audit log', permission: 'audit.read'},
  {href: '/account', label: 'Account'}
]
```

`src/app/(shell)/_components/nav.tsx`:

```tsx
'use client'

import {NAV} from '@/config/nav'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {type Me, hasPermission} from '@shop/shared/access'

export function Nav({me}: {me: Me}) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.filter(item => !item.permission || hasPermission(me.permissions, item.permission)).map(
        item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className="text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground rounded-md px-3 py-2 text-sm">
            {item.label}
          </Link>
        )
      )}
    </nav>
  )
}
```

`src/app/(shell)/layout.tsx`:

```tsx
import {requireMe} from '@/lib/session'
import type {ReactNode} from 'react'

import {Nav} from './_components/nav'

export default async function ShellLayout({children}: {children: ReactNode}) {
  const me = await requireMe()
  return (
    <div className="grid min-h-screen grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-6 border-r p-4">
        <p className="text-sm font-semibold">Shop Admin</p>
        <Nav me={me} />
        <p className="text-muted-foreground mt-auto text-xs">
          {me.email} · {me.role.name}
        </p>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  )
}
```

`src/app/(shell)/page.tsx`:

```tsx
import {requireMe} from '@/lib/session'

export default async function HomePage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome, {me.name || me.email}</h1>
      <p className="text-muted-foreground">
        The dashboard arrives with deliveries (sub-project 5).
      </p>
    </section>
  )
}
```

`next.config.ts` — add the same dev rewrite as `apps/web`:

```ts
rewrites: () =>
  Promise.resolve(
    process.env.NODE_ENV === 'production'
      ? []
      : [
          {
            source: '/api/:path*',
            destination: `${process.env.API_ORIGIN ?? 'http://localhost:4000'}/api/:path*`
          }
        ]
  )
```

Root `layout.tsx` wraps `{children}` in `<Providers>`. `layout.tsx` must call `connection()` (from `next/server`) before reading cookies only in the shell layout — `requireMe()` uses `cookies()`, which already makes the route dynamic, so `next build` does not call the API (verify with `pnpm --filter @shop/admin build` and `API_ORIGIN` unset).

- [ ] **Step 5: Run** — `pnpm --filter @shop/admin test && pnpm --filter @shop/admin build` → PASS, build succeeds with no API running.

- [ ] **Step 6: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/admin .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "feat(admin): session gate, shell navigation and generated API client"
```

---

### Task 11: Sign-in pages (`/login`, `/invite/[token]`, `/2fa`, `/account`)

**Files:**

- Create: `apps/admin/src/app/(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/invite/[token]/page.tsx`, `(auth)/2fa/page.tsx`, `apps/admin/src/features/auth/components/sign-in-form.tsx`, `features/auth/components/totp-setup.tsx`, `features/auth/components/totp-challenge.tsx`, `features/auth/schemas.ts`, `apps/admin/src/app/(shell)/account/page.tsx`, `features/auth/components/account-actions.tsx`
- Modify: `packages/ui` — add `input.tsx`, `label.tsx` (shadcn) if absent
- Test: `features/auth/components/sign-in-form.test.tsx`, `totp-setup.test.tsx`, `totp-challenge.test.tsx`

**Interfaces:**

- Consumes: `authClient` (Task 10), `getMe` (for redirects), `/api/invite-lookup/:token`.
- Produces: `<SignInForm email?: string; googleEnabled: boolean />` (step 1 email → `authClient.emailOtp.sendVerificationOtp({email, type: 'sign-in'})`; step 2 code → `authClient.signIn.emailOtp({email, otp})`, then `router.push('/2fa')`); `<TotpSetup />` (`authClient.twoFactor.enable({})` → QR from `totpURI` via `qrcode.react`, confirm with `authClient.twoFactor.verifyTotp({code})`, then shows backup codes once with "I saved them" → `router.replace('/')`); `<TotpChallenge />` (code or backup code tabs → `verifyTotp` / `verifyBackupCode` → `router.replace('/')`).

- [ ] **Step 1: Failing tests**

`sign-in-form.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {SignInForm} from './sign-in-form'

const sendVerificationOtp = jest.fn(() => Promise.resolve({data: {success: true}, error: null}))
const emailOtp = jest.fn(() => Promise.resolve({data: {}, error: null}))
const social = jest.fn()
const push = jest.fn()
jest.mock('@/lib/auth-client', () => ({
  authClient: {emailOtp: {sendVerificationOtp}, signIn: {emailOtp, social}}
}))
jest.mock('next/navigation', () => ({useRouter: () => ({push})}))

describe('SignInForm', () => {
  it('asks for the code after sending it, then signs in and goes to 2FA', async () => {
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'Ann@Example.com'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    await waitFor(() => {
      expect(sendVerificationOtp).toHaveBeenCalledWith({email: 'ann@example.com', type: 'sign-in'})
    })
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '123456'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    await waitFor(() => {
      expect(emailOtp).toHaveBeenCalledWith({email: 'ann@example.com', otp: '123456'})
      expect(push).toHaveBeenCalledWith('/2fa')
    })
  })

  it('locks the email for an invite and offers Google when enabled', () => {
    render(<SignInForm email="ann@example.com" googleEnabled />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', {name: 'Continue with Google'}))
    expect(social).toHaveBeenCalledWith({provider: 'google', callbackURL: '/2fa'})
  })

  it('shows a wrong-code error without leaving the form', async () => {
    emailOtp.mockResolvedValueOnce({data: null, error: {message: 'Invalid OTP'}} as never)
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '000000'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That code did not work')
  })
})
```

`totp-setup.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {TotpSetup} from './totp-setup'

const enable = jest.fn(() =>
  Promise.resolve({
    data: {totpURI: 'otpauth://totp/Shop:a?secret=ABC', backupCodes: ['aaaa-1111', 'bbbb-2222']},
    error: null
  })
)
const verifyTotp = jest.fn(() => Promise.resolve({data: {}, error: null}))
const replace = jest.fn()
jest.mock('@/lib/auth-client', () => ({authClient: {twoFactor: {enable, verifyTotp}}}))
jest.mock('next/navigation', () => ({useRouter: () => ({replace})}))

describe('TotpSetup', () => {
  it('shows the QR, confirms a code, then shows backup codes once', async () => {
    render(<TotpSetup />)
    expect(
      await screen.findByRole('img', {name: 'QR code for your authenticator app'})
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '123456'}})
    fireEvent.click(screen.getByRole('button', {name: 'Confirm'}))
    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'I saved them'}))
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/')
    })
  })
})
```

`totp-challenge.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {TotpChallenge} from './totp-challenge'

const verifyTotp = jest.fn(() => Promise.resolve({data: {}, error: null}))
const verifyBackupCode = jest.fn(() => Promise.resolve({data: {}, error: null}))
const replace = jest.fn()
jest.mock('@/lib/auth-client', () => ({authClient: {twoFactor: {verifyTotp, verifyBackupCode}}}))
jest.mock('next/navigation', () => ({useRouter: () => ({replace})}))

describe('TotpChallenge', () => {
  it('accepts an app code', async () => {
    render(<TotpChallenge />)
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '654321'}})
    fireEvent.click(screen.getByRole('button', {name: 'Verify'}))
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({code: '654321', trustDevice: false})
      expect(replace).toHaveBeenCalledWith('/')
    })
  })
  it('accepts a backup code instead', async () => {
    render(<TotpChallenge />)
    fireEvent.click(screen.getByRole('button', {name: 'Use a backup code'}))
    fireEvent.change(screen.getByLabelText('Backup code'), {target: {value: 'aaaa-1111'}})
    fireEvent.click(screen.getByRole('button', {name: 'Verify'}))
    await waitFor(() => {
      expect(verifyBackupCode).toHaveBeenCalledWith({code: 'aaaa-1111', trustDevice: false})
    })
  })
})
```

- [ ] **Step 2: Run** — FAIL (modules not found).

- [ ] **Step 3: Implement**

`features/auth/schemas.ts`:

```ts
import * as v from 'valibot'

export const EmailSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email'))
})
export const CodeSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.regex(/^\d{6}$/, 'Enter the 6 digits'))
})
export const BackupSchema = v.object({
  code: v.pipe(v.string(), v.trim(), v.minLength(6, 'Enter a backup code'))
})
```

`sign-in-form.tsx`:

```tsx
'use client'

import {CodeSchema, EmailSchema} from '@/features/auth/schemas'
import {authClient} from '@/lib/auth-client'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'

export function SignInForm({
  email: invited,
  googleEnabled
}: {
  email?: string
  googleEnabled: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const emailForm = useForm({
    resolver: valibotResolver(EmailSchema),
    defaultValues: {email: invited ?? ''}
  })
  const codeForm = useForm({resolver: valibotResolver(CodeSchema), defaultValues: {code: ''}})
  const emailErrors = useFormState({control: emailForm.control}).errors
  const codeErrors = useFormState({control: codeForm.control}).errors

  const sendCode = emailForm.handleSubmit(async ({email: value}) => {
    setError(null)
    // The API answers the same for every email (no enumeration); invite-only is enforced on sign-in.
    await authClient.emailOtp.sendVerificationOtp({email: value, type: 'sign-in'})
    setEmail(value)
  })

  const signIn = codeForm.handleSubmit(async ({code}) => {
    if (!email) return
    const {error: failed} = await authClient.signIn.emailOtp({email, otp: code})
    if (failed) {
      setError('That code did not work. Check the latest email or request a new code.')
      return
    }
    router.push('/2fa')
  })

  return (
    <div className="flex flex-col gap-6">
      {email === null ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3" noValidate>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly={Boolean(invited)}
            {...emailForm.register('email')}
          />
          {emailErrors.email && (
            <p className="text-destructive text-sm">{emailErrors.email.message}</p>
          )}
          <Button type="submit">Send code</Button>
        </form>
      ) : (
        <form onSubmit={signIn} className="flex flex-col gap-3" noValidate>
          <p className="text-muted-foreground text-sm">
            We sent a code to {email} if it is allowed to sign in.
          </p>
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...codeForm.register('code')}
          />
          {codeErrors.code && <p className="text-destructive text-sm">{codeErrors.code.message}</p>}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit">Sign in</Button>
        </form>
      )}
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void authClient.signIn.social({provider: 'google', callbackURL: '/2fa'})}>
          Continue with Google
        </Button>
      )}
    </div>
  )
}
```

`totp-setup.tsx` and `totp-challenge.tsx` follow the same pattern: `useForm` + `valibotResolver(CodeSchema | BackupSchema)`, `authClient.twoFactor.enable({})` in an effect on mount (setup), `<QRCodeSVG value={totpURI} role="img" aria-label="QR code for your authenticator app" />`, confirm via `verifyTotp({code})`, then render backup codes in a `<ul>` with "I saved them" → `router.replace('/')`; challenge toggles between `verifyTotp({code, trustDevice: false})` and `verifyBackupCode({code, trustDevice: false})`, error `role="alert"` "That code did not work.".

Pages (server components):

```tsx
// (auth)/login/page.tsx
import {SignInForm} from '@/features/auth/components/sign-in-form'
import {getMe} from '@/lib/session'
import {redirect} from 'next/navigation'

export default async function LoginPage() {
  const me = await getMe()
  if (me.state === 'ok') redirect('/')
  if (me.state === '2fa') redirect('/2fa')
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-24">
      <h1 className="text-2xl font-semibold">Sign in to Shop Admin</h1>
      <SignInForm googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
    </section>
  )
}
```

```tsx
// (auth)/invite/[token]/page.tsx
import {SignInForm} from '@/features/auth/components/sign-in-form'

import type {InviteLookup} from '@shop/shared/access'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'
const MESSAGES = {
  expired: 'This invite has expired. Ask for a new one.',
  used: 'This invite was already used. Sign in instead.',
  revoked: 'This invite was cancelled.'
}

export default async function InvitePage({params}: {params: Promise<{token: string}>}) {
  const {token} = await params
  const res = await fetch(`${API_ORIGIN}/api/invite-lookup/${encodeURIComponent(token)}`, {
    cache: 'no-store'
  })
  const invite = res.ok ? ((await res.json()) as InviteLookup) : null
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-24">
      <h1 className="text-2xl font-semibold">Join Shop Admin</h1>
      {invite?.status === 'valid' ? (
        <SignInForm email={invite.email} googleEnabled={process.env.GOOGLE_SIGN_IN === 'on'} />
      ) : (
        <p role="alert">{invite ? MESSAGES[invite.status] : 'This invite link is not valid.'}</p>
      )}
    </section>
  )
}
```

```tsx
// (auth)/2fa/page.tsx
import {TotpChallenge} from '@/features/auth/components/totp-challenge'
import {TotpSetup} from '@/features/auth/components/totp-setup'
import {getMe} from '@/lib/session'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

export default async function TwoFactorPage() {
  const me = await getMe()
  if (me.state === 'ok') redirect('/')
  if (me.state === 'signed-out') redirect('/login')
  // Better Auth's own session tells whether TOTP is set up yet.
  const res = await fetch(`${API_ORIGIN}/api/auth/get-session`, {
    headers: {cookie: (await cookies()).toString()},
    cache: 'no-store'
  })
  const session = (await res.json()) as {user?: {twoFactorEnabled?: boolean}} | null
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-24">
      <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
      {session?.user?.twoFactorEnabled ? <TotpChallenge /> : <TotpSetup />}
    </section>
  )
}
```

`GOOGLE_SIGN_IN=on` is set in the admin env when the API has Google keys (add to `.env.example`).

`(shell)/account/page.tsx`: two buttons in `account-actions.tsx` — "Regenerate backup codes" (`authClient.twoFactor.generateBackupCodes({})`, shows them once) and "Sign out everywhere" (`authClient.revokeSessions()` then `router.replace('/login')`).

Add `packages/ui/src/input.tsx` and `label.tsx` from shadcn (`pnpm dlx shadcn@latest add input label` in `packages/ui`, or copy the shadcn source), export them like `button`.

- [ ] **Step 4: Run** — `pnpm --filter @shop/admin test` → PASS (6 new tests).

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/admin packages/ui pnpm-lock.yaml
git commit -m "feat(admin): sign-in with emailed code or Google and mandatory TOTP"
```

---

### Task 12: Team and audit pages

**Files:**

- Create: `apps/admin/src/app/(shell)/team/page.tsx`, `features/team/components/admins-table.tsx`, `invites-panel.tsx`, `roles-matrix.tsx`, `apps/admin/src/app/(shell)/audit/page.tsx`, `features/audit/components/audit-table.tsx`
- Modify: `packages/ui` — `tabs.tsx`, `table.tsx`, `select.tsx`, `checkbox.tsx` (shadcn)
- Test: `features/team/components/admins-table.test.tsx`, `invites-panel.test.tsx`, `roles-matrix.test.tsx`, `features/audit/components/audit-table.test.tsx`

**Interfaces:**

- Consumes: generated RTK hooks (`useGetApiAdminAdminsQuery`, `usePatchApiAdminAdminsByIdRoleMutation`, `usePostApiAdminAdminsByIdReset2FaMutation`, `useDeleteApiAdminAdminsByIdMutation`, `useGetApiAdminInvitesQuery`, `usePostApiAdminInvitesMutation`, `usePostApiAdminInvitesByIdResendMutation`, `useDeleteApiAdminInvitesByIdMutation`, `useGetApiAdminRolesQuery`, `usePostApiAdminRolesMutation`, `usePatchApiAdminRolesByIdMutation`, `useDeleteApiAdminRolesByIdMutation`, `useGetApiAdminAuditQuery` — use the exact names codegen produced in Task 10), `Me`, `PERMISSIONS`, `hasPermission`.
- Produces: pages `/team` (requires `admin.invite`, else `notFound()`), `/audit` (requires `audit.read`).

- [ ] **Step 1: Failing tests** (render with a test store: `renderWithStore(ui, {preloaded mocks via msw-free jest.spyOn(global, 'fetch')})`; helper `apps/admin/src/test/render-with-store.tsx` creates `makeStore()` and wraps in `Provider`). Example — `admins-table.test.tsx`:

```tsx
import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {AdminsTable} from './admins-table'

const admins = [
  {
    id: 'o',
    email: 'owner@x.io',
    name: 'Owner',
    role: {id: 'r0', name: 'OWNER'},
    twoFactorEnabled: true,
    disabledAt: null
  },
  {
    id: 'a',
    email: 'ann@x.io',
    name: 'Ann',
    role: {id: 'r1', name: 'ADMIN'},
    twoFactorEnabled: true,
    disabledAt: null
  }
]
const roles = [
  {id: 'r0', name: 'OWNER', isSystem: true, permissions: []},
  {id: 'r1', name: 'ADMIN', isSystem: true, permissions: []},
  {id: 'r2', name: 'SUPPORT', isSystem: true, permissions: []}
]

function mockApi() {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET')
    if (url.endsWith('/api/admin/admins') && method === 'GET')
      return Promise.resolve(Response.json(admins))
    if (url.endsWith('/api/admin/roles')) return Promise.resolve(Response.json(roles))
    return Promise.resolve(Response.json({...admins[1], disabledAt: '2026-10-12T00:00:00.000Z'}))
  })
}

describe('AdminsTable', () => {
  it('lists admins and protects the owner row', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    expect(await screen.findByText('ann@x.io')).toBeInTheDocument()
    const ownerRow = screen.getByText('owner@x.io').closest('tr') as HTMLElement
    expect(ownerRow).not.toHaveTextContent('Remove')
  })

  it('removes an admin after confirmation', async () => {
    const fetchMock = mockApi()
    renderWithStore(<AdminsTable canChangeRoles />)
    fireEvent.click(await screen.findByRole('button', {name: 'Remove ann@x.io'}))
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([req]) => req instanceof Request && req.method === 'DELETE')
      ).toBe(true)
    })
  })

  it('hides the role picker without role.write', async () => {
    mockApi()
    renderWithStore(<AdminsTable canChangeRoles={false} />)
    await screen.findByText('ann@x.io')
    expect(screen.queryByRole('combobox', {name: 'Role of ann@x.io'})).not.toBeInTheDocument()
  })
})
```

`invites-panel.test.tsx` (create invite validates email; list shows status Open / Accepted / Revoked; Resend and Cancel buttons call the right endpoints); `roles-matrix.test.tsx` (system roles are read-only; ticking a permission on a custom role and pressing Save sends `PATCH` with the new list; creating a role); `audit-table.test.tsx` (rows render actor email, action, time; "Load more" requests `?cursor=<nextCursor>`; filter by action sends `?action=`). Write each in the same style as above, one behaviour per test.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** the four components with the generated hooks and shadcn `Table`, `Tabs`, `Select`, `Checkbox`, `Dialog`-free inline confirm (a second "Remove" button appears in the row; `Modal` from web is not shared, keep it simple). `/team/page.tsx`:

```tsx
import {AdminsTable} from '@/features/team/components/admins-table'
import {InvitesPanel} from '@/features/team/components/invites-panel'
import {RolesMatrix} from '@/features/team/components/roles-matrix'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'

export default async function TeamPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'admin.invite')) notFound()
  const canChangeRoles = hasPermission(me.permissions, 'role.write')
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="admins">
          <AdminsTable canChangeRoles={canChangeRoles} />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesPanel />
        </TabsContent>
        <TabsContent value="roles">
          <RolesMatrix editable={canChangeRoles} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
```

`/audit/page.tsx` is the same shape with `audit.read` and `<AuditTable />`.

- [ ] **Step 4: Run** — `pnpm --filter @shop/admin test` → PASS.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/admin packages/ui pnpm-lock.yaml
git commit -m "feat(admin): team page with admins, invites and roles, and the audit log"
```

---

### Task 13: e2e: invite to team, permissions

**Files:**

- Modify: `compose.yaml` (add `mailpit` service: image `axllent/mailpit:v1`, ports `127.0.0.1:8025:8025`, `127.0.0.1:1025:1025`), `compose.e2e.yaml` (api env: `SMTP_URL: smtp://mailpit:1025`, `REDIS_URL: redis://redis:6379`, `BETTER_AUTH_URL: http://admin.shop.localhost`, `BETTER_AUTH_SECRET: e2e-secret-at-least-32-characters-long`, `ADMIN_OWNER_EMAIL: owner@shop.localhost`; migrate env the same so the seed mails the owner invite; admin env `API_ORIGIN: http://api:4000`; depends_on mailpit and redis)
- Create: `e2e/tests/admin.spec.ts`, `e2e/support/mailpit.ts`
- Modify: `e2e/package.json` (`otplib` dev dependency), `.github/workflows/ci.yml` only if the e2e job lists services explicitly

**Interfaces:**

- Consumes: the whole stack.
- Produces: `latestMail(to): Promise<{subject: string; text: string}>` (Mailpit API `GET http://localhost:8025/api/v1/search?query=to:<email>` → `GET /api/v1/message/<id>`), `signInWithCode(page, email)`, `setUpTotp(page): Promise<string>` (reads the secret from the QR's otpauth URI exposed as `data-uri` on the QR element, or from the "Can't scan?" text secret shown under it — add that text in Task 11 if missing).

- [ ] **Step 1: Write the tests** — `e2e/tests/admin.spec.ts`:

```ts
import {expect, test} from '@playwright/test'
import {generateSync} from 'otplib'

import {latestMail} from '../support/mailpit'

const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
test.describe.configure({mode: 'serial'})
test.skip(({browserName}) => browserName !== 'chromium', 'one browser is enough for the auth flow')

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', {name: 'Send code'}).click()
  await expect(page.getByLabel('6-digit code')).toBeVisible()
  const mail = await latestMail(email)
  await page.getByLabel('6-digit code').fill(/^(\d{6})/.exec(mail.subject)?.[1] ?? '')
  await page.getByRole('button', {name: 'Sign in'}).click()
}

let ownerSecret = ''

test('the owner accepts the seeded invite, sets up TOTP and reaches the team page', async ({
  page
}) => {
  const invite = await latestMail('owner@shop.localhost')
  const link = /https?:\/\/\S+\/invite\/[\w-]{43}/.exec(invite.text)?.[0] ?? ''
  await page.goto(link)
  await signIn(page, 'owner@shop.localhost')
  await expect(page).toHaveURL(/\/2fa$/)
  ownerSecret = (await page.getByTestId('totp-secret').textContent()) ?? ''
  await page.getByLabel('Code from the app').fill(generateSync({secret: ownerSecret}))
  await page.getByRole('button', {name: 'Confirm'}).click()
  await page.getByRole('button', {name: 'I saved them'}).click()
  await page.getByRole('link', {name: 'Team'}).click()
  await expect(page.getByRole('heading', {name: 'Team'})).toBeVisible()
})

test('a SUPPORT admin cannot open the audit log', async ({page, browser}) => {
  // Owner invites sue as SUPPORT.
  const owner = await browser.newPage()
  await owner.goto(`${ADMIN}/login`)
  await signIn(owner, 'owner@shop.localhost')
  await owner.getByLabel('Code from the app').fill(generateSync({secret: ownerSecret}))
  await owner.getByRole('button', {name: 'Verify'}).click()
  await owner.goto(`${ADMIN}/team`)
  await owner.getByRole('tab', {name: 'Invites'}).click()
  await owner.getByLabel('Email').fill('sue@shop.localhost')
  await owner.getByLabel('Role').selectOption({label: 'SUPPORT'})
  await owner.getByRole('button', {name: 'Send invite'}).click()

  const link =
    /https?:\/\/\S+\/invite\/[\w-]{43}/.exec((await latestMail('sue@shop.localhost')).text)?.[0] ??
    ''
  await page.goto(link)
  await signIn(page, 'sue@shop.localhost')
  const secret = (await page.getByTestId('totp-secret').textContent()) ?? ''
  await page.getByLabel('Code from the app').fill(generateSync({secret}))
  await page.getByRole('button', {name: 'Confirm'}).click()
  await page.getByRole('button', {name: 'I saved them'}).click()
  await expect(page.getByRole('link', {name: 'Audit log'})).toHaveCount(0)
  const res = await page.goto(`${ADMIN}/audit`)
  expect(res?.status()).toBe(404)
})

test('a signed-in session without TOTP is sent to /2fa', async ({page}) => {
  await page.goto(`${ADMIN}/login`)
  await signIn(page, 'owner@shop.localhost')
  await page.goto(`${ADMIN}/team`)
  await expect(page).toHaveURL(/\/2fa$/)
})
```

`e2e/support/mailpit.ts`:

```ts
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'

/** The newest message to `to`, retried for a few seconds because sending is not awaited. */
export async function latestMail(to: string): Promise<{subject: string; text: string}> {
  for (let i = 0; i < 20; i++) {
    const list = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    ).json()) as {messages: {ID: string}[]}
    const id = list.messages[0]?.ID
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
        Subject: string
        Text: string
      }
      return {subject: msg.Subject, text: msg.Text}
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`no mail to ${to}`)
}
```

In `totp-setup.tsx` (Task 11) render the secret under the QR: `<p>Can't scan? Enter <code data-testid="totp-secret">{secret}</code></p>` where `secret = new URL(totpURI).searchParams.get('secret')`.

- [ ] **Step 2: Run against the stack** — `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm --filter @shop/e2e exec playwright test tests/admin.spec.ts` → PASS (3 tests). Then the full suite → all pass.

- [ ] **Step 3: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add compose.yaml compose.e2e.yaml e2e pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "test(e2e): admin invite, TOTP and permission flow with Mailpit"
```

---

### Task 14: Docs and configuration

**Files:**

- Create: `docs/adr/0009-better-auth-in-nestjs.md`
- Modify: `CLAUDE.md`, `.env.example`, `docs/runbooks/deploy.md`, `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md` (roadmap row 3 → points to 3a/3b/3c; §6.2 Admin adds `session.twoFactorVerifiedAt`, `user.disabledAt`)

- [ ] **Step 1: ADR 0009** — sections Context (Better Auth chosen in parent §7.1; Next apps have no route handlers), Decision (Better Auth in `apps/api` via `@thallesp/nestjs-better-auth`, `bodyParser: false`, our `AdminSessionGuard` with the TOTP rule replaces the integration's global guard on `/api/admin/*`, admin reaches the API same-origin through `/api`), Consequences (public controllers need `@AllowAnonymous()`; one auth instance outside Nest DI shares `getMailer()` and its own Prisma client; spike findings from the ledger).

- [ ] **Step 2: CLAUDE.md** — under Architecture rules add:

```markdown
- Admin auth: Better Auth in `apps/api` (ADR 0009). Admin endpoints use `@AdminController(path)` (session + TOTP + permissions + audit) and `@RequirePermission(...)` with permissions from `@shop/shared/access`; public endpoints are marked `@AllowAnonymous()`. Admin data access is RTK Query generated from `apps/api/openapi.json` (`pnpm --filter @shop/admin codegen`).
```

- [ ] **Step 3: `.env.example`** — append:

```bash
# apps/api — admin auth (sub-project 3a)
BETTER_AUTH_URL=http://admin.shop.localhost
BETTER_AUTH_SECRET=change-me-to-32-or-more-random-characters
REDIS_URL=redis://localhost:6379
# Mail: Resend in production, Mailpit (docker compose up -d mailpit) locally; neither = logged to the console
RESEND_API_KEY=
SMTP_URL=smtp://localhost:1025
MAIL_FROM="Shop Admin <no-reply@shop.localhost>"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
# Seed: the first owner's invite goes to this address
ADMIN_OWNER_EMAIL=
# apps/admin — show the Google button (the API must have Google keys)
GOOGLE_SIGN_IN=off
```

- [ ] **Step 4: Runbook** — `docs/runbooks/deploy.md`: Dokploy env for `shop-api` (all of the above with production values; `BETTER_AUTH_URL=https://admin.<domain>`; `MAIL_FROM` on the verified Resend domain), for `shop-admin` (`API_ORIGIN`, `GOOGLE_SIGN_IN=on`); Dokploy domain routing must send `admin.<domain>/api/*` to `shop-api` (same as `shop.localhost` in `infra/traefik/*.yml`); Google Cloud Console origins and redirect URIs (from spec §9); first owner: set `ADMIN_OWNER_EMAIL`, run the seed once, open the emailed link.

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add docs CLAUDE.md .env.example
git commit -m "docs: ADR 0009, admin auth rules, env and deploy runbook"
```
