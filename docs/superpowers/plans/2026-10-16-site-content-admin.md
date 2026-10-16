# Site Content Admin (Sub-project 3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins with `content.write` edit the rules (draft, publish, versions, restore), the allowlisted UI texts and the brand settings, and the storefront shows them within a minute with safe fallbacks.

**Architecture:** A `content` module in `apps/api` stores the rules as versioned JSON documents, UI texts as per-key overrides and brand settings as one row; public read endpoints feed the web app through cached `fetch` (ADR 0007), admin endpoints go through `@AdminController` with `content.write`. Message files move to a new `@shop/messages` package so the API can validate overrides against the defaults. The admin app gets three pages built on the 3b toolkit (`SortableList`, `useOptimisticOrder`, `apiErrorMessage`, version-in-a-ref).

**Tech Stack:** NestJS 11, Prisma 7, Valibot, `@formatjs/icu-messageformat-parser`, Next.js 16 + next-intl, RTK Query codegen, react-hook-form, dnd-kit, Jest, Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-site-content-admin-design.md` (changes) on top of `docs/superpowers/specs/2026-10-09-site-content-design.md` (phase 2: §4, §5, §6.2–6.5, §7, §8, §10). Read both.

## Global Constraints

- Branch `feat/site-content` (built on `feat/catalog-admin`). Business logic only in `apps/api`; Next apps have no route handlers.
- Permission `content.write`: added to `PERMISSIONS` and `SYSTEM_ROLES.ADMIN`; a migration appends it to the existing `ADMIN` role. Public content endpoints are `@AllowAnonymous()`.
- Errors: `{statusCode, message, issues?}`. `409 stale` (rules draft `revision` or settings `version` mismatch), `400 unknown_key` (key not in `EDITABLE_MESSAGES`), `422 placeholder_mismatch` (issues: `{expected: string[], found: string[]}`), `404 not_published` (public rules before the first publish), `400 Validation failed` from `ValibotPipe`.
- Limits: rule section title ≤ 120 chars, item text ≤ 2000 chars, ≤ 50 sections, ≤ 100 items per section, links in rule texts `https:` or site-relative `/…` (not `//`); override ≤ 2000 chars; settings name parts 1–24 chars, `serverIp` hostname or IPv4 with optional `:port`, `discordUrl` `https:`, `supportEmail` email.
- Rules: missing PL text falls back to EN and the public API returns that field with `lang: 'en'`; numbering is positional, computed on read.
- Web caching: `fetch(url, {next: {revalidate: CONTENT_REVALIDATE_SECONDS, tags}})` (env, default 60; e2e 1). Tags `content-rules`, `content-messages`, `content-settings`. Failures are never cached; fallbacks: rules → "temporarily unavailable" state (`null`), settings → `DEFAULT_SITE_SETTINGS`, overrides → `{}`.
- Swagger: every content route has `operationId`, `tags` (`['Content']` public, `['Content admin']` admin), `summary`, `description` (what, permission, storefront effect) and a description per response.
- Admin: EN only; forms per ADR 0006; drag and drop with `SortableList`; editors keep the `revision`/`version` they loaded in a ref (from load and successful saves only); update mutations invalidate tags only on success; `@shop/ui/button` has only `variant` default|outline, `size` default|lg.
- Rich text: `parseInline` moves from `apps/web/src/features/rules/lib/inline-markdown.ts` to `@shop/shared/rules` (pure); each app keeps its own styled renderer (ruling: `@shop/ui` would force the web theme tokens on the admin).
- TDD; Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; before each commit `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm --filter @shop/api test:int -- <specs>` for DB tasks). `graphify query` before grepping, `graphify update .` after code edits. Never commit secrets; new env vars in `.env.example`. Do not bump ESLint (9) / TypeScript (6) majors.

## Review Focus

1. **An override that drops or renames an ICU argument or rich tag** (`"Join {count} players"` → `"Join players"`, or `<accent>` removed): API answers `422 placeholder_mismatch` and the page never crashes on a missing argument. Pinned in Task 1 (unit) and Task 6 (int).
2. **API down or 500 while the web renders** (first request after deploy, or Postgres down): home and rules still render — file texts, `DEFAULT_SITE_SETTINGS`, rules "temporarily unavailable" — and the failure is not cached. Pinned in Task 8.
3. **Two admins edit the rules draft**: the second save with the old `revision` is `409 stale`, the draft is unchanged, and the editor keeps its text and its old revision so a second click is still refused. Pinned in Task 5 (int) and Task 10 (component).
4. **A PL rule field left empty**: public API returns the EN text with `lang: 'en'`; publishing with an empty EN field is refused. Pinned in Task 4.
5. **A rule text with `[click](javascript:alert(1))` or `//evil.com`**: API refuses it on save (400); even stored data renders as plain text. Pinned in Task 2 (unit) and Task 5 (int).

## File Structure

```
packages/messages/                       NEW @shop/messages
  en.json, pl.json                       moved from apps/web/messages
  src/editable.ts                        EDITABLE_MESSAGES, isEditableKey
  src/placeholders.ts                    messageArguments(text) via ICU parser
  src/flat.ts                            flattenMessages, getMessage
packages/shared/src/rules.ts             parseInline, toPlainText, hasOnlySafeLinks, RulesDocumentSchema, PublicRulesSchema
packages/shared/src/content.ts           SiteSettings*, MessageOverride*, RulesDraft*, RulesVersion* schemas
packages/shared/src/access.ts            + content.write
apps/api/prisma/…                        RulesDraft, RulesVersion, MessageOverride, SiteSettings + 2 migrations
apps/api/src/seed/seed-content.ts        first published rules version + settings row
apps/api/src/seed/demo-rules.ts          demo rules (moved from apps/web/src/features/rules/data)
apps/api/src/content/                    content.module, public controller/service, rules-admin, messages-admin, settings-admin
apps/api/src/openapi/content-paths.ts
apps/web/src/features/rules/api/get-rules.ts, features/site-settings/api/get-site-settings.ts,
apps/web/src/features/content/api/get-message-overrides.ts, src/i18n/apply-overrides.ts, src/i18n/request.ts
apps/web/src/config/content.ts           CONTENT_REVALIDATE_SECONDS
apps/admin/src/features/content/…        settings-form, texts-table, rules-editor, rules-preview, versions-list
apps/admin/src/app/(shell)/content/{settings,texts,rules}/page.tsx
docs/adr/0008-site-content-in-the-database.md
```

---

### Task 1: `@shop/messages` package

**Files:**

- Create: `packages/messages/package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `jest.config.*` (copy the shape of `packages/shared`)
- Move: `apps/web/messages/en.json` → `packages/messages/en.json`, `apps/web/messages/pl.json` → `packages/messages/pl.json` (`git mv`)
- Create: `packages/messages/src/editable.ts`, `placeholders.ts`, `flat.ts` and their `*.spec.ts`
- Move: `apps/web/src/i18n/messages.test.ts` → `packages/messages/src/messages.spec.ts`
- Modify: `apps/web/src/i18n/request.ts`, `apps/web/package.json` (dependency `@shop/messages`), `apps/web/Dockerfile` if it copies `apps/web/messages`

**Interfaces:**

- Produces: `@shop/messages/en.json`, `@shop/messages/pl.json` (JSON exports); from `@shop/messages`: `EDITABLE_MESSAGES`, `isEditableKey(key: string): boolean`, `messageArguments(text: string): string[]` (sorted unique ICU argument names plus `<tag>` names as `'<tag>'`; throws on unparsable ICU), `flattenMessages(messages: object): Record<string, string>`, `getMessage(locale: 'en' | 'pl', key: string): string | undefined`.

- [ ] **Step 1: Write the failing tests**

`packages/messages/src/editable.spec.ts`:

```ts
import {EDITABLE_MESSAGES, isEditableKey} from './editable'

describe('isEditableKey', () => {
  it('matches exact keys and namespace wildcards', () => {
    expect(isEditableKey('hero.title')).toBe(true)
    expect(isEditableKey('faq.q1')).toBe(true)
    expect(isEditableKey('how.step1.title')).toBe(true)
  })

  it('refuses keys outside the allowlist', () => {
    expect(isEditableKey('hero.left1')).toBe(false)
    expect(isEditableKey('cart.title')).toBe(false)
    expect(isEditableKey('consent.text')).toBe(false)
    expect(isEditableKey('faqx.q1')).toBe(false)
    expect(isEditableKey('')).toBe(false)
  })

  it('lists the spec allowlist', () => {
    expect(EDITABLE_MESSAGES).toContain('rules.lead')
  })
})
```

`packages/messages/src/placeholders.spec.ts`:

```ts
import {messageArguments} from './placeholders'

describe('messageArguments', () => {
  it('collects arguments and rich-text tags, sorted and unique', () => {
    expect(messageArguments('Server <accent>rules</accent> for {name}, {name}')).toEqual([
      '<accent>',
      'name'
    ])
  })

  it('finds arguments inside plural branches', () => {
    expect(messageArguments('{count, plural, one {# rule in {section}} other {# rules}}')).toEqual([
      'count',
      'section'
    ])
  })

  it('is empty for plain text', () => {
    expect(messageArguments('Just text')).toEqual([])
  })

  it('throws on broken ICU', () => {
    expect(() => messageArguments('Hello {name')).toThrow()
  })
})
```

`packages/messages/src/flat.spec.ts`:

```ts
import {flattenMessages, getMessage} from './flat'

describe('flat messages', () => {
  it('flattens nested keys with dots', () => {
    expect(flattenMessages({a: {b: 'x', c: {d: 'y'}}, e: 'z'})).toEqual({
      'a.b': 'x',
      'a.c.d': 'y',
      'e': 'z'
    })
  })

  it('reads a default by locale and key', () => {
    expect(getMessage('en', 'rules.lead')).toEqual(expect.any(String))
    expect(getMessage('pl', 'nope.key')).toBeUndefined()
  })
})
```

`messages.spec.ts`: the moved parity and plural tests, importing `../en.json` and `../pl.json`, plus:

```ts
it('every allowlisted pattern matches at least one key, and every matched EN default parses', () => {
  const keys = Object.keys(flattenMessages(en))
  const matches = (pattern: string, key: string) =>
    pattern.endsWith('.*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern
  const dead = EDITABLE_MESSAGES.filter(pattern => !keys.some(key => matches(pattern, key)))
  expect(dead).toEqual([])
  for (const locale of ['en', 'pl'] as const)
    for (const key of keys.filter(isEditableKey))
      expect(() => messageArguments(getMessage(locale, key) ?? '')).not.toThrow()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @shop/messages test`
Expected: FAIL (package/modules missing).

- [ ] **Step 3: Implement**

`packages/messages/package.json` (adapt scripts/devDependencies from `packages/shared/package.json`):

```json
{
  "name": "@shop/messages",
  "private": true,
  "exports": {
    ".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"},
    "./en.json": "./en.json",
    "./pl.json": "./pl.json"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@formatjs/icu-messageformat-parser": "<the version already in the lockfile, 3.5.x>"
  }
}
```

`src/index.ts` re-exports nothing else than the three modules' public names (this is the package entry, not a barrel inside an app): `export {EDITABLE_MESSAGES, isEditableKey} from './editable'`, `export {messageArguments} from './placeholders'`, `export {flattenMessages, getMessage} from './flat'`. If the repo's lint forbids barrels in packages, use subpath exports (`./editable`, `./placeholders`, `./flat`) instead and adjust imports in later tasks — record which.

`src/editable.ts`:

```ts
/** UI texts an admin may override (site-content spec §8). Adding a key is a code change. */
export const EDITABLE_MESSAGES = [
  'meta.title',
  'meta.description',
  'hero.title',
  'hero.lead',
  'hero.joinUs',
  'hero.newSeason',
  'hero.version',
  'how.*',
  'fair.title',
  'fair.lead',
  'faq.*',
  'footer.demo',
  'rules.title',
  'rules.lead'
] as const

export function isEditableKey(key: string): boolean {
  return EDITABLE_MESSAGES.some(pattern =>
    pattern.endsWith('.*')
      ? key.startsWith(pattern.slice(0, -1)) && key.length > pattern.length - 1
      : key === pattern
  )
}
```

`src/placeholders.ts`:

```ts
import {type MessageFormatElement, TYPE, parse} from '@formatjs/icu-messageformat-parser'

function collect(elements: MessageFormatElement[], out: Set<string>): void {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        out.add(el.value)
        break
      case TYPE.plural:
      case TYPE.select:
        out.add(el.value)
        for (const option of Object.values(el.options)) collect(option.value, out)
        break
      case TYPE.tag:
        out.add(`<${el.value}>`)
        collect(el.children, out)
        break
      default:
        break
    }
  }
}

/** Argument names and `<tag>` names a message uses; an override must keep exactly these (spec §5). */
export function messageArguments(text: string): string[] {
  const out = new Set<string>()
  collect(parse(text), out)
  return [...out].sort()
}
```

`src/flat.ts`:

```ts
import en from '../en.json'
import pl from '../pl.json'

export function flattenMessages(messages: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null
        ? Object.entries(flattenMessages(v as object, `${prefix}${k}.`))
        : [[`${prefix}${k}`, String(v)]]
    )
  )
}

const FLAT = {en: flattenMessages(en), pl: flattenMessages(pl)}

/** The file default for one key, or undefined when the key does not exist. */
export const getMessage = (locale: 'en' | 'pl', key: string): string | undefined =>
  FLAT[locale][key]
```

(`resolveJsonModule` in its tsconfig; the build must emit JSON or reference `../en.json` at runtime — check `dist` resolves `../en.json`, i.e. keep the JSON at the package root and `rootDir: '.'`, or copy the JSON into `dist` in the build script.)

`apps/web/src/i18n/request.ts`: replace the dynamic import with

```ts
import en from '@shop/messages/en.json'
import pl from '@shop/messages/pl.json'

const FILES = {en, pl} as const
// …
return {locale, messages: FILES[locale] as AbstractIntlMessages}
```

Update any other importer of `apps/web/messages` (next-intl `global.d.ts` type augmentation, Dockerfile COPY) found with `graphify query`/grep.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @shop/messages test && pnpm --filter @shop/messages build && pnpm --filter @shop/web test && pnpm --filter @shop/web typecheck && pnpm --filter @shop/web build`
Expected: PASS; the web build still needs no API.

- [ ] **Step 5: Commit**

```bash
git add packages/messages apps/web pnpm-lock.yaml
git commit -m "refactor(web): move ui messages to @shop/messages with the editable allowlist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content contract in `@shop/shared`

**Files:**

- Create: `packages/shared/src/rules.ts`, `rules.spec.ts`, `packages/shared/src/content.ts`, `content.spec.ts`
- Modify: `packages/shared/src/access.ts` (+ `content.write`, `SYSTEM_ROLES.ADMIN`), `access.spec.ts`, `packages/shared/package.json` (exports `./rules`, `./content`)
- Move: `parseInline`/`toPlainText`/`Inline` from `apps/web/src/features/rules/lib/inline-markdown.ts` into `rules.ts` (move its tests too); web imports from `@shop/shared/rules` and the old file is deleted.
- Regenerate: `apps/api/openapi.json` and the admin client if the permission enum changed them (`pnpm --filter @shop/api openapi && pnpm --filter @shop/admin codegen`); update tests that list ADMIN permissions (`apps/api/test/admin-session.int-spec.ts`).

**Interfaces:**

- Produces (`@shop/shared/rules`): `parseInline`, `toPlainText`, `Inline`, `hasOnlySafeLinks(text): boolean`, `RulesDocumentSchema`, `RulesDocument`, `PublicRulesSchema`, `PublicRules` (`{publishedAt: string; sections: {id; title: {value; lang: 'en'|'pl'}; items: {id; text: {value; lang}}[]}[]}`).
- Produces (`@shop/shared/content`): `SiteSettingsSchema` (`{siteName: {plain, accent}, serverIp, discordUrl, supportEmail}`), `SiteSettings`, `AdminSiteSettingsSchema` (`SiteSettings & {version: number}`), `SiteSettingsUpdateSchema` (same + `version`), `RulesDraftSchema` (`{content: RulesDocument; revision: number; updatedAt: string; updatedBy: string}`), `RulesDraftUpdateSchema` (`{content; revision}`), `RulesVersionListSchema` (`{versions: {id: number; publishedAt: string; publishedBy: string}[]; nextCursor: number | null}`), `RulesVersionsQuerySchema` (`{cursor?: string}` → number), `MessageLocaleSchema` (`'en'|'pl'`), `MessageOverrideInputSchema` (`{value: string ≤ 2000}`), `AdminMessageSchema` (`{key; namespace; default: string; override: string | null}`), `AdminMessagesSchema` (array), `PublicMessagesSchema` (`Record<string,string>`).

- [ ] **Step 1: Write the failing tests**

`rules.spec.ts` (plus the moved `inline-markdown` tests):

```ts
import * as v from 'valibot'

import {RulesDocumentSchema, hasOnlySafeLinks} from './rules'

const doc = (text = 'Be nice. See [rules](/rules).') => ({
  sections: [
    {id: 'general', title: {en: 'General', pl: 'Ogólne'}, items: [{id: 'g1', text: {en: text}}]}
  ]
})

describe('hasOnlySafeLinks', () => {
  it.each(['[a](https://x.io)', '[a](/rules)', 'no links'])('accepts %s', t => {
    expect(hasOnlySafeLinks(t)).toBe(true)
  })
  it.each([
    '[a](javascript:alert(1))',
    '[a](//evil.com)',
    '[a](http://x.io)',
    '[a](data:text/html,x)'
  ])('refuses %s', t => {
    expect(hasOnlySafeLinks(t)).toBe(false)
  })
})

describe('RulesDocumentSchema', () => {
  it('accepts a document with an optional PL text', () => {
    expect(v.safeParse(RulesDocumentSchema, doc()).success).toBe(true)
  })
  it('refuses an unsafe link', () => {
    expect(v.safeParse(RulesDocumentSchema, doc('[x](javascript:alert(1))')).success).toBe(false)
  })
  it('refuses an empty EN text and too long texts', () => {
    expect(v.safeParse(RulesDocumentSchema, doc('')).success).toBe(false)
    expect(v.safeParse(RulesDocumentSchema, doc('x'.repeat(2001))).success).toBe(false)
  })
  it('refuses duplicate section or item ids', () => {
    const d = doc()
    d.sections.push({...d.sections[0]!})
    expect(v.safeParse(RulesDocumentSchema, d).success).toBe(false)
  })
  it('caps sections at 50 and items at 100', () => {
    const many = {
      sections: Array.from({length: 51}, (_, i) => ({id: `s${i}`, title: {en: 'T'}, items: []}))
    }
    expect(v.safeParse(RulesDocumentSchema, many).success).toBe(false)
  })
})
```

`content.spec.ts`:

```ts
import * as v from 'valibot'

import {MessageOverrideInputSchema, SiteSettingsUpdateSchema} from './content'

const settings = {
  siteName: {plain: 'Block', accent: 'haus'},
  serverIp: 'mc.mineblaze.net',
  discordUrl: 'https://discord.gg/abc',
  supportEmail: 'support@blockhaus.example',
  version: 1
}

describe('content schemas', () => {
  it('accepts valid settings', () => {
    expect(v.safeParse(SiteSettingsUpdateSchema, settings).success).toBe(true)
    expect(
      v.safeParse(SiteSettingsUpdateSchema, {...settings, serverIp: '95.217.1.1:25565'}).success
    ).toBe(true)
  })
  it.each([
    {serverIp: 'not a host!'},
    {discordUrl: 'http://discord.gg/abc'},
    {supportEmail: 'nope'},
    {siteName: {plain: '', accent: 'haus'}},
    {siteName: {plain: 'x'.repeat(25), accent: 'haus'}}
  ])('refuses %p', patch => {
    expect(v.safeParse(SiteSettingsUpdateSchema, {...settings, ...patch}).success).toBe(false)
  })
  it('caps an override at 2000 characters', () => {
    expect(v.safeParse(MessageOverrideInputSchema, {value: 'x'.repeat(2001)}).success).toBe(false)
  })
})
```

Access: `SYSTEM_ROLES.ADMIN` becomes `['admin.invite', 'audit.read', 'catalog.write', 'server.rcon', 'content.write']`; `PERMISSIONS` gains `'content.write'`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @shop/shared test`
Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/shared/src/rules.ts` — paste `Inline`, `parseInline`, `toPlainText` from the web file unchanged, then:

```ts
import * as v from 'valibot'

const LINK = /\[[^\]]+\]\(([^)\s]+)\)/g
// Same rule as parseInline's SAFE_HREF: https:// or a site path, never //host.
const SAFE_HREF = /^(https:\/\/|\/(?!\/))/i

/** Every [label](href) in the text points to https: or a site path (spec §5). */
export const hasOnlySafeLinks = (text: string): boolean =>
  [...text.matchAll(LINK)].every(m => SAFE_HREF.test(m[1] ?? ''))

const RuleText = (max: number) =>
  v.object({
    en: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, 'Enter the English text'),
      v.maxLength(max),
      v.check(hasOnlySafeLinks, 'Links must start with https:// or /')
    ),
    pl: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(max),
        v.check(hasOnlySafeLinks, 'Links must start with https:// or /')
      )
    )
  })
const RuleId = v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,60}$/))
const unique = (ids: string[]) => new Set(ids).size === ids.length

export const RulesDocumentSchema = v.pipe(
  v.object({
    sections: v.pipe(
      v.array(
        v.object({
          id: RuleId,
          title: RuleText(120),
          items: v.pipe(v.array(v.object({id: RuleId, text: RuleText(2000)})), v.maxLength(100))
        })
      ),
      v.maxLength(50)
    )
  }),
  v.check(d => unique(d.sections.map(s => s.id)), 'Section ids must be unique'),
  v.check(d => unique(d.sections.flatMap(s => s.items.map(i => i.id))), 'Item ids must be unique')
)
export type RulesDocument = v.InferOutput<typeof RulesDocumentSchema>

const Localized = v.object({value: v.string(), lang: v.picklist(['en', 'pl'])})
export const PublicRulesSchema = v.object({
  publishedAt: v.pipe(v.string(), v.isoTimestamp()),
  sections: v.array(
    v.object({
      id: v.string(),
      title: Localized,
      items: v.array(v.object({id: v.string(), text: Localized}))
    })
  )
})
export type PublicRules = v.InferOutput<typeof PublicRulesSchema>
```

Give the API-facing fields `v.description(...)` like 3b (Swagger shows them).

`packages/shared/src/content.ts`:

```ts
import * as v from 'valibot'

import {RulesDocumentSchema} from './rules'

const NamePart = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(24))
// hostname (labels of a-z0-9-) or dotted IPv4, optional :port
const HOST =
  /^(?=.{1,253}$)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::\d{1,5})?$/i

export const SiteSettingsSchema = v.object({
  siteName: v.object({plain: NamePart, accent: NamePart}),
  serverIp: v.pipe(
    v.string(),
    v.trim(),
    v.regex(HOST, 'Use a host name or IP, optionally with :port')
  ),
  discordUrl: v.pipe(
    v.string(),
    v.trim(),
    v.url(),
    v.startsWith('https://', 'Use an https:// link')
  ),
  supportEmail: v.pipe(v.string(), v.trim(), v.email())
})
export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>
const Version = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2_147_483_647))
export const AdminSiteSettingsSchema = v.object({...SiteSettingsSchema.entries, version: Version})
export const SiteSettingsUpdateSchema = AdminSiteSettingsSchema

export const RulesDraftSchema = v.object({
  content: RulesDocumentSchema,
  revision: v.number(),
  updatedAt: v.string(),
  updatedBy: v.string()
})
export const RulesDraftUpdateSchema = v.object({
  content: RulesDocumentSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2_147_483_647))
})
export const RulesVersionListSchema = v.object({
  versions: v.array(v.object({id: v.number(), publishedAt: v.string(), publishedBy: v.string()})),
  nextCursor: v.nullable(v.number())
})
export const RulesVersionsQuerySchema = v.object({
  cursor: v.optional(v.pipe(v.string(), v.regex(/^[1-9]\d{0,9}$/), v.transform(Number)))
})

export const MessageLocaleSchema = v.picklist(['en', 'pl'])
export const MessageOverrideInputSchema = v.object({value: v.pipe(v.string(), v.maxLength(2000))})
export const AdminMessageSchema = v.object({
  key: v.string(),
  namespace: v.string(),
  default: v.string(),
  override: v.nullable(v.string())
})
export const AdminMessagesSchema = v.array(AdminMessageSchema)
export const PublicMessagesSchema = v.record(v.string(), v.string())

export type AdminSiteSettings = v.InferOutput<typeof AdminSiteSettingsSchema>
export type RulesDraft = v.InferOutput<typeof RulesDraftSchema>
export type RulesDraftUpdate = v.InferOutput<typeof RulesDraftUpdateSchema>
export type RulesVersionList = v.InferOutput<typeof RulesVersionListSchema>
export type AdminMessage = v.InferOutput<typeof AdminMessageSchema>
```

(Add `v.description` to the public fields.) Web: `apps/web/src/features/rules/types.ts` keeps its UI types; `get-rules` will parse with `PublicRulesSchema` in Task 8. Change web imports of `parseInline`/`toPlainText` to `@shop/shared/rules`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @shop/shared test && pnpm --filter @shop/shared build && pnpm test && pnpm typecheck`
Expected: PASS (fix the ADMIN-permission list in `apps/api/test/admin-session.int-spec.ts`; run `pnpm --filter @shop/api test:int -- test/admin-session.int-spec.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/web apps/api apps/admin
git commit -m "feat(shared): site content contract, rules schema with safe links, content.write

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tables, migrations and seed

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261016100000_site_content/migration.sql`, `apps/api/prisma/migrations/20261016100100_content_write_permission/migration.sql`
- Create: `apps/api/src/seed/demo-rules.ts` (EN+PL demo rules as one `RulesDocument`, built from the phase-1 data files), `apps/api/src/seed/seed-content.ts`, `apps/api/test/content-schema.int-spec.ts`
- Modify: `apps/api/src/seed/main.ts` (run `seedContent` after `seedCatalog`), `apps/api/test/seed.int-spec.ts` if it asserts the output

**Interfaces:**

- Produces: Prisma models `RulesDraft`, `RulesVersion`, `MessageOverride`, `SiteSettings` (with `version Int @default(1)`) per base spec §4; `seedContent(prisma): Promise<void>` — creates the settings row from `DEFAULT_SITE_SETTINGS` values and, if no version exists, a draft (revision 0) and a first `RulesVersion` with the demo document; never overwrites existing rows.

- [ ] **Step 1: Write the failing test**

`apps/api/test/content-schema.int-spec.ts`:

```ts
import {readFileSync} from 'node:fs'
import path from 'node:path'

import {PrismaService} from '../src/prisma/prisma.service'
import {seedContent} from '../src/seed/seed-content'
import {API_ROOT, startDatabase} from './support/database'

jest.setTimeout(120_000)

const PERMISSION_SQL = readFileSync(
  path.join(API_ROOT, 'prisma/migrations/20261016100100_content_write_permission/migration.sql'),
  'utf8'
)

describe('site content schema', () => {
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

  it('seeds settings, a draft and the first published version once', async () => {
    await seedContent(prisma)
    await seedContent(prisma)
    expect(await prisma.rulesVersion.count()).toBe(1)
    const settings = await prisma.siteSettings.findUniqueOrThrow({where: {id: 1}})
    expect(settings).toMatchObject({siteNamePlain: 'Block', siteNameAccent: 'haus', version: 1})
    const draft = await prisma.rulesDraft.findUniqueOrThrow({where: {id: 1}})
    expect(draft.revision).toBe(0)
  })

  it('keeps an edited settings row on a re-run', async () => {
    await prisma.siteSettings.update({where: {id: 1}, data: {serverIp: 'play.example.com'}})
    await seedContent(prisma)
    expect((await prisma.siteSettings.findUniqueOrThrow({where: {id: 1}})).serverIp).toBe(
      'play.example.com'
    )
  })

  it('gives an existing ADMIN role content.write once', async () => {
    await prisma.role.create({data: {name: 'ADMIN', isSystem: true, permissions: ['admin.invite']}})
    await prisma.$executeRawUnsafe(PERMISSION_SQL)
    await prisma.$executeRawUnsafe(PERMISSION_SQL)
    const admin = await prisma.role.findUniqueOrThrow({where: {name: 'ADMIN'}})
    expect(admin.permissions.filter(p => p === 'content.write')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @shop/api test:int -- test/content-schema.int-spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Prisma models from base spec §4 with `@@map` snake_case table names like the rest (`rules_drafts`, `rules_versions`, `message_overrides`, `site_settings`) and `version Int @default(1)` on `SiteSettings`. `MessageOverride.locale` uses the existing `Locale` enum. Write the migration SQL to match (`prisma migrate diff --from-migrations … --to-schema-datamodel …` against a throwaway DB is fine for generating it; commit the SQL).

Permission migration:

```sql
-- The seed runs once in production, so an existing ADMIN role gets content.write here. Idempotent.
UPDATE "roles"
SET "permissions" = ARRAY(
  SELECT DISTINCT p FROM unnest("permissions" || ARRAY['content.write']::text[]) AS p ORDER BY p
)
WHERE "name" = 'ADMIN' AND "isSystem" = true;
```

`demo-rules.ts`: a `DEMO_RULES: RulesDocument` combining `apps/web/src/features/rules/data/rules.en.ts` and `rules.pl.ts` (same ids; `title: {en, pl}`, `text: {en, pl}`) and `DEMO_RULES_PUBLISHED_AT = new Date('2026-05-28T12:00:00Z')`. Validate it in a unit test with `RulesDocumentSchema`. (The web data files stay until Task 8 removes them.)

`seed-content.ts`:

```ts
import type {Prisma, PrismaClient} from '../generated/prisma/client'
import {DEMO_RULES, DEMO_RULES_PUBLISHED_AT} from './demo-rules'

/** Settings row and first rules edition; never overwrites admin edits on a re-run. */
export async function seedContent(prisma: PrismaClient): Promise<void> {
  await prisma.siteSettings.upsert({
    where: {id: 1},
    update: {},
    create: {
      id: 1,
      siteNamePlain: 'Block',
      siteNameAccent: 'haus',
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example',
      updatedBy: 'seed'
    }
  })
  const content = DEMO_RULES as unknown as Prisma.InputJsonValue
  await prisma.rulesDraft.upsert({
    where: {id: 1},
    update: {},
    create: {id: 1, content, updatedBy: 'seed'}
  })
  if ((await prisma.rulesVersion.count()) === 0)
    await prisma.rulesVersion.create({
      data: {content, publishedAt: DEMO_RULES_PUBLISHED_AT, publishedBy: 'seed'}
    })
}
```

(The settings values are the current `DEFAULT_SITE_SETTINGS` in `apps/web/src/config/site.ts`; keep them identical.)

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @shop/api exec prisma generate && pnpm --filter @shop/api test && pnpm --filter @shop/api test:int -- test/content-schema.int-spec.ts test/seed.int-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): site content tables, content.write for ADMIN, seed the first rules edition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Public content endpoints

**Files:**

- Create: `apps/api/src/content/content.module.ts`, `content.controller.ts`, `content.service.ts`, `localize-rules.ts`, `localize-rules.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/content-public.int-spec.ts`, `apps/api/test/support/content-app.ts` (like `catalog-app.ts`: DB + Redis + `seedAccess` + `seedContent`, `admin(role)` helper — reused by Tasks 5–6)

**Interfaces:**

- Produces: `GET /api/content/rules?locale=en|pl` → `PublicRules` or `404 not_published`; `GET /api/content/messages?locale=` → `Record<string,string>` (overrides only, flat keys); `GET /api/content/settings` → `SiteSettings` (no version). All `@AllowAnonymous()`, `Cache-Control: no-store`. `localizeRules(doc: RulesDocument, publishedAt: Date, locale): PublicRules`. `startContentApp()` → `{app, prisma, admin, stop}`.

- [ ] **Step 1: Write the failing tests**

`localize-rules.spec.ts`:

```ts
import {localizeRules} from './localize-rules'

const doc = {
  sections: [
    {
      id: 's1',
      title: {en: 'General', pl: 'Ogólne'},
      items: [
        {id: 'i1', text: {en: 'Be nice', pl: ''}},
        {id: 'i2', text: {en: 'No cheats', pl: 'Bez cheatów'}}
      ]
    }
  ]
}

describe('localizeRules', () => {
  it('uses PL where present and falls back to EN with lang en', () => {
    const r = localizeRules(doc, new Date('2026-10-16T08:00:00Z'), 'pl')
    expect(r.publishedAt).toBe('2026-10-16T08:00:00.000Z')
    expect(r.sections[0]?.title).toEqual({value: 'Ogólne', lang: 'pl'})
    expect(r.sections[0]?.items).toEqual([
      {id: 'i1', text: {value: 'Be nice', lang: 'en'}},
      {id: 'i2', text: {value: 'Bez cheatów', lang: 'pl'}}
    ])
  })

  it('returns EN as EN', () => {
    expect(localizeRules(doc, new Date(), 'en').sections[0]?.title).toEqual({
      value: 'General',
      lang: 'en'
    })
  })
})
```

`content-public.int-spec.ts`:

```ts
import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

describe('public content API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })
  const http = () => request(ctx.app.getHttpServer())

  it('serves the published rules in Polish without a session', async () => {
    const res = await http().get('/api/content/rules?locale=pl').expect(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toMatchObject({publishedAt: '2026-05-28T12:00:00.000Z'})
    expect((res.body as {sections: unknown[]}).sections.length).toBeGreaterThan(0)
  })

  it('refuses an unknown locale', async () => {
    await http().get('/api/content/rules?locale=de').expect(400)
  })

  it('answers 404 not_published before the first publish', async () => {
    await ctx.prisma.rulesVersion.deleteMany()
    await http()
      .get('/api/content/rules?locale=en')
      .expect(404)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'not_published'})
      })
  })

  it('serves overrides as flat keys and the settings row', async () => {
    await ctx.prisma.messageOverride.create({
      data: {locale: 'en', key: 'hero.title', value: 'Hi', updatedBy: 'test'}
    })
    await http()
      .get('/api/content/messages?locale=en')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({'hero.title': 'Hi'})
      })
    await http()
      .get('/api/content/settings')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({
          siteName: {plain: 'Block', accent: 'haus'},
          serverIp: 'mc.mineblaze.net',
          discordUrl: 'https://discord.com',
          supportEmail: 'support@blockhaus.example'
        })
      })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @shop/api exec jest src/content && pnpm --filter @shop/api test:int -- test/content-public.int-spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`localize-rules.ts`:

```ts
import type {PublicRules, RulesDocument} from '@shop/shared/rules'

type Locale = 'en' | 'pl'
const pick = (text: {en: string; pl?: string}, locale: Locale) =>
  locale === 'pl' && text.pl?.trim()
    ? {value: text.pl, lang: 'pl' as const}
    : {value: text.en, lang: 'en' as const}

/** Published document → public shape; an empty PL field falls back to EN and says so (spec §6.5). */
export function localizeRules(doc: RulesDocument, publishedAt: Date, locale: Locale): PublicRules {
  return {
    publishedAt: publishedAt.toISOString(),
    sections: doc.sections.map(s => ({
      id: s.id,
      title: pick(s.title, locale),
      items: s.items.map(i => ({id: i.id, text: pick(i.text, locale)}))
    }))
  }
}
```

`content.service.ts`: `rules(locale)` reads the newest `RulesVersion` (`orderBy: {publishedAt: 'desc'}, {id: 'desc'}`), throws `notFound` with message `not_published` (build it with `new NotFoundException({statusCode: 404, message: 'not_published'})`), parses `content` with `RulesDocumentSchema` (a malformed stored row → 500 + log, same rule as the catalog), returns `localizeRules`; `messages(locale)` returns `Object.fromEntries(rows.filter(r => isEditableKey(r.key)).map(r => [r.key, r.value]))`; `settings()` maps the row to `SiteSettings` (falls back to 404 `not_found` if the row is missing — the seed always creates it).

`content.controller.ts`: `@AllowAnonymous() @Controller('content')`, `@Header('Cache-Control', 'no-store')` on each route, query validated with `ValibotPipe(v.object({locale: MessageLocaleSchema}))`.

`startContentApp()` in `test/support/content-app.ts`: copy `catalog-app.ts`, replacing `seedCatalog` with `seedContent` (keep `seedAccess`, `relaxRateLimits`, the `admin()` helper).

- [ ] **Step 4: Run the tests**

Run: the Step 2 commands, then `pnpm --filter @shop/api test` (admin-routes and OpenAPI coverage tests ignore non-admin routes; the OpenAPI document comes in Task 7).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): public rules, message overrides and site settings endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Admin rules: draft, publish, versions, restore

**Files:**

- Create: `apps/api/src/content/rules-admin.controller.ts`, `rules-admin.service.ts`
- Modify: `apps/api/src/content/content.module.ts`
- Create: `apps/api/test/content-rules-admin.int-spec.ts`

**Interfaces:**

- Produces (all `@AdminController('content/rules')`, `@RequirePermission('content.write')` on every route incl. reads — spec §5): `GET /draft` → `RulesDraft`; `PUT /draft` body `RulesDraftUpdate` → `RulesDraft` (revision + 1) or `409 stale`; `POST /publish` → `{id, publishedAt}` (201); `GET /versions?cursor=` → `RulesVersionList` (20 per page, newest first, `nextCursor` = last id or null); `POST /versions/:id/restore` → `RulesDraft` (revision + 1; does not publish). Audit actions `rules.draft`, `rules.publish`, `rules.restore`; `before` = previous draft revision summary `{revision}` (never the whole document twice is fine either; keep rows small: `{revision, sections: n}`).

- [ ] **Step 1: Write the failing test**

```ts
import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

type Draft = {
  revision: number
  content: {sections: {id: string; title: {en: string; pl?: string}; items: unknown[]}[]}
}

describe('admin rules API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const edited = (d: Draft, title: string) => ({
    revision: d.revision,
    content: {
      ...d.content,
      sections: [{...d.content.sections[0]!, title: {en: title}}, ...d.content.sections.slice(1)]
    }
  })

  it('needs content.write, even to read the draft', async () => {
    const catalogOnly = await ctx.admin({permissions: ['catalog.write']})
    await catalogOnly.get('/api/admin/content/rules/draft').expect(403)
  })

  it('saves the draft with the current revision and refuses a stale one', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    const saved = (
      await editor.put('/api/admin/content/rules/draft').send(edited(draft, 'Basics')).expect(200)
    ).body as Draft
    expect(saved.revision).toBe(draft.revision + 1)
    await editor
      .put('/api/admin/content/rules/draft')
      .send(edited(draft, 'Other'))
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    const now = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    expect(now.content.sections[0]?.title.en).toBe('Basics')
  })

  it('refuses unsafe links in the draft', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    await editor
      .put('/api/admin/content/rules/draft')
      .send(edited(draft, '[x](javascript:alert(1))'))
      .expect(400)
  })

  it('publishes the draft as a new public edition and lists versions', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const before = await ctx.prisma.rulesVersion.count()
    await editor.post('/api/admin/content/rules/publish').expect(201)
    expect(await ctx.prisma.rulesVersion.count()).toBe(before + 1)
    const pub = await request(ctx.app.getHttpServer())
      .get('/api/content/rules?locale=en')
      .expect(200)
    expect((pub.body as {sections: {title: {value: string}}[]}).sections[0]?.title.value).toBe(
      'Basics'
    )
    const list = (await editor.get('/api/admin/content/rules/versions').expect(200)).body as {
      versions: {id: number}[]
      nextCursor: number | null
    }
    expect(list.versions.length).toBe(before + 1)
    expect(list.versions[0]!.id).toBeGreaterThan(list.versions[1]!.id)
  })

  it('restores an old version into the draft without publishing it', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const oldest = await ctx.prisma.rulesVersion.findFirstOrThrow({orderBy: {id: 'asc'}})
    const draft = (
      await editor
        .post(`/api/admin/content/rules/versions/${String(oldest.id)}/restore`)
        .expect(201)
    ).body as Draft
    expect(draft.content.sections[0]?.title.en).toBe('General')
    const pub = await request(ctx.app.getHttpServer())
      .get('/api/content/rules?locale=en')
      .expect(200)
    expect((pub.body as {sections: {title: {value: string}}[]}).sections[0]?.title.value).toBe(
      'Basics'
    )
    await editor.post('/api/admin/content/rules/versions/999999/restore').expect(404)
  })

  it('writes audit rows for save, publish and restore', async () => {
    const actions = (
      await ctx.prisma.auditLog.findMany({where: {action: {startsWith: 'rules.'}}})
    ).map(r => r.action)
    expect(actions).toEqual(
      expect.arrayContaining(['rules.draft', 'rules.publish', 'rules.restore'])
    )
  })
})
```

(Adjust the seeded first section title `'General'` to whatever `DEMO_RULES` uses.)

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @shop/api test:int -- test/content-rules-admin.int-spec.ts` → FAIL (404).

- [ ] **Step 3: Implement**

Service, all writes inside `this.prisma.$transaction`:

- `draft()`: row → `{content, revision, updatedAt: iso, updatedBy}` (parse `content` with `RulesDocumentSchema`).
- `save(input, actorEmail, before)`: `updateMany({where: {id: 1, revision: input.revision}, data: {content, revision: {increment: 1}, updatedBy}})`; count 0 → `stale()` (from `common/http-errors`); return the new draft.
- `publish(actorEmail)`: read the draft, re-validate it, `rulesVersion.create({content, publishedBy})`, return `{id, publishedAt}`.
- `versions(cursor?)`: `findMany({where: cursor ? {id: {lt: cursor}} : {}, orderBy: {id: 'desc'}, take: 21, select: {id, publishedAt, publishedBy}})` → first 20 + `nextCursor`.
- `restore(id, actorEmail, before)`: version or `notFound()`; draft `update({content: version.content, revision: {increment: 1}, updatedBy})`.

`updatedBy`/`publishedBy` = the admin's email from `adminOf(req)`. Controller per the 3b pattern (`@Audited`, `req.auditBefore` via callbacks, `ValibotPipe`).

- [ ] **Step 4: Run** — the Step 2 command and `pnpm --filter @shop/api test` → PASS.

- [ ] **Step 5: Commit** — `feat(api): rules draft, publish, versions and restore for admins` (+ trailer).

---

### Task 6: Admin texts and settings

**Files:**

- Create: `apps/api/src/content/messages-admin.controller.ts`, `messages-admin.service.ts`, `settings-admin.controller.ts`, `settings-admin.service.ts`, `messages-admin.service.spec.ts`
- Modify: `apps/api/src/content/content.module.ts`
- Create: `apps/api/test/content-texts-settings.int-spec.ts`

**Interfaces:**

- Produces (`content.write`): `GET /api/admin/content/messages?locale=` → `AdminMessage[]` (every key in the EN file matching `isEditableKey`, sorted by key; `namespace` = text before the first dot; `default` from `getMessage(locale, key)`; `override` or null); `PUT /api/admin/content/messages/:locale/:key` body `{value}` → `AdminMessage`; `DELETE /api/admin/content/messages/:locale/:key` → 204 (idempotent); `GET /api/admin/content/settings` → `AdminSiteSettings`; `PUT /api/admin/content/settings` body `SiteSettingsUpdate` → `AdminSiteSettings` (version + 1) or `409 stale`. Audit: `message.override`, `message.reset`, `settings.update`.

- [ ] **Step 1: Write the failing tests**

Unit (`messages-admin.service.spec.ts`) for the validation helper `checkOverride(locale, key, value)`:

```ts
import {checkOverride} from './messages-admin.service'

describe('checkOverride', () => {
  it('accepts a text with the same arguments and tags', () => {
    expect(() => {
      checkOverride('en', 'rules.title', 'Our <accent>rules</accent>')
    }).not.toThrow()
  })
  it('refuses a key outside the allowlist with 400 unknown_key', () => {
    expect(() => {
      checkOverride('en', 'cart.title', 'x')
    }).toThrow(expect.objectContaining({status: 400}) as Error)
  })
  it('refuses a dropped tag with 422 placeholder_mismatch and both lists', () => {
    try {
      checkOverride('en', 'rules.title', 'Our rules')
      throw new Error('no throw')
    } catch (error) {
      expect(error).toMatchObject({
        status: 422,
        response: {message: 'placeholder_mismatch', issues: {expected: ['<accent>'], found: []}}
      })
    }
  })
  it('refuses broken ICU with 422', () => {
    expect(() => {
      checkOverride('en', 'hero.title', 'Hello {name')
    }).toThrow(expect.objectContaining({status: 422}) as Error)
  })
})
```

Int (`content-texts-settings.int-spec.ts`):

```ts
import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

describe('admin texts and settings API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  it('lists allowlisted keys with defaults and sets, reads and resets an override', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const list = (await editor.get('/api/admin/content/messages?locale=pl').expect(200)).body as {
      key: string
      default: string
      override: string | null
    }[]
    expect(list.some(m => m.key === 'cart.title')).toBe(false)
    const title = list.find(m => m.key === 'hero.title')
    expect(title).toMatchObject({override: null, default: expect.any(String) as string})

    await editor
      .put('/api/admin/content/messages/pl/hero.title')
      .send({value: 'Nowy tytuł'})
      .expect(200)
    await request(ctx.app.getHttpServer())
      .get('/api/content/messages?locale=pl')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({'hero.title': 'Nowy tytuł'})
      })
    await editor.delete('/api/admin/content/messages/pl/hero.title').expect(204)
    await editor.delete('/api/admin/content/messages/pl/hero.title').expect(204)
    await request(ctx.app.getHttpServer())
      .get('/api/content/messages?locale=pl')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({})
      })
  })

  it('refuses unknown keys and placeholder changes', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    await editor.put('/api/admin/content/messages/en/cart.title').send({value: 'x'}).expect(400)
    await editor
      .put('/api/admin/content/messages/en/rules.title')
      .send({value: 'Rules'})
      .expect(422)
    await editor.put('/api/admin/content/messages/de/hero.title').send({value: 'x'}).expect(400)
  })

  it('updates settings with the version and refuses a stale one', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const s = (await editor.get('/api/admin/content/settings').expect(200)).body as {
      version: number
      serverIp: string
    }
    const next = {...s, serverIp: 'play.example.com'}
    await editor
      .put('/api/admin/content/settings')
      .send(next)
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({serverIp: 'play.example.com', version: s.version + 1})
      })
    await editor
      .put('/api/admin/content/settings')
      .send({...next, serverIp: 'x.example.com'})
      .expect(409)
    await request(ctx.app.getHttpServer())
      .get('/api/content/settings')
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({serverIp: 'play.example.com'})
      })
  })

  it('needs content.write', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.get('/api/admin/content/settings').expect(403)
    await support.put('/api/admin/content/messages/en/hero.title').send({value: 'x'}).expect(403)
  })
})
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**

```ts
// messages-admin.service.ts (validation part)
import {UnprocessableEntityException} from '@nestjs/common'

import {getMessage, isEditableKey, messageArguments} from '@shop/messages'

import {badRequest} from '../common/http-errors'

const mismatch = (expected: string[], found: string[]) =>
  new UnprocessableEntityException({
    statusCode: 422,
    message: 'placeholder_mismatch',
    issues: {expected, found}
  })

/** Allowlisted key, same ICU arguments and tags as the file default (spec §5). */
export function checkOverride(locale: 'en' | 'pl', key: string, value: string): void {
  const fallback = getMessage(locale, key)
  if (!isEditableKey(key) || fallback === undefined) throw badRequest('unknown_key')
  const expected = messageArguments(fallback)
  let found: string[]
  try {
    found = messageArguments(value)
  } catch {
    throw mismatch(expected, [])
  }
  if (expected.join('\n') !== found.join('\n')) throw mismatch(expected, found)
}
```

The `:locale` param is validated with `MessageLocaleSchema` (400 otherwise). Upsert/delete `MessageOverride` by `{locale_key}`; `delete` uses `deleteMany` (idempotent). Settings: `updateMany({where: {id: 1, version}, data: {...fields, version: {increment: 1}, updatedBy}})` + `assertUpdated` from `catalog-admin/versioned.ts` (or move that helper to `common/` and import it from both — preferred, update the catalog imports).

- [ ] **Step 4: Run** — unit + int specs, `pnpm --filter @shop/api test` → PASS.

- [ ] **Step 5: Commit** — `feat(api): admin text overrides with placeholder checks, and versioned site settings` (+ trailer).

---

### Task 7: Swagger and the admin client

**Files:**

- Create: `apps/api/src/openapi/content-paths.ts`
- Modify: `apps/api/src/openapi/openapi.ts`, `openapi.spec.ts`, `apps/api/openapi.json` (regenerated), `apps/admin/src/lib/api/generated.ts` (codegen), `apps/admin/openapi-config.ts` (include `/content` paths: the filter is `/\/(admin|invite)/` — admin content paths already match; public `/api/content/*` are not needed by the admin), `apps/admin/src/lib/api/tags.ts`

**Interfaces:**

- Produces operationIds (hooks `use<Name>Query|Mutation`): public `getPublicRules`, `getPublicMessages`, `getPublicSettings` (tag `Content`); admin `getRulesDraft`, `saveRulesDraft`, `publishRules`, `listRulesVersions`, `restoreRulesVersion`, `listContentMessages`, `setContentMessage`, `resetContentMessage`, `getContentSettings`, `updateContentSettings` (tag `Content admin`). Cache tags `RulesDraft`, `RulesVersions`, `ContentMessages`, `ContentSettings`; `saveRulesDraft`, `updateContentSettings`, `setContentMessage` invalidate only on success (`onSuccess` helper from 3b's tags.ts); `publishRules` invalidates `RulesVersions`; `restoreRulesVersion` invalidates `RulesDraft` on success.

- [ ] **Step 1: Write the failing tests** — extend `openapi.spec.ts`:

```ts
it('explains every content operation and response', () => {
  const ops = Object.entries(doc.paths)
    .filter(([p]) => p.startsWith('/api/content') || p.startsWith('/api/admin/content'))
    .flatMap(([p, methods]) =>
      Object.entries(methods).map(([m, op]) => ({where: `${m} ${p}`, p, op}))
    )
  expect(ops.length).toBe(13)
  const gaps = ops.flatMap(({where, p, op}) => [
    ...(/^[a-z]\w+$/.test(op.operationId ?? '') ? [] : [`${where}: operationId`]),
    ...(op.tags?.join() === (p.startsWith('/api/admin') ? 'Content admin' : 'Content')
      ? []
      : [`${where}: tags`]),
    ...(op.description?.trim() ? [] : [`${where}: description`]),
    ...Object.entries(op.responses)
      .filter(([, r]) => !r.description.trim())
      .map(([c]) => `${where}: ${c}`)
  ])
  expect(gaps).toEqual([])
})
```

`admin-routes.spec.ts` already fails while the admin content routes are undocumented.

- [ ] **Step 2: Run** — `pnpm --filter @shop/api exec jest src/openapi src/access/admin-routes.spec.ts` → FAIL.

- [ ] **Step 3: Implement** — `content-paths.ts` in the style of `catalog-admin-paths.ts` (helpers from `./helpers`): every route with summary, description naming the permission (`content.write`) or "No session needed", the storefront effect ("live within a minute"), and responses: public rules `200`, `400`, `404 not_published`; draft PUT `200`, `400` (invalid document / unsafe link), `401`/`403`, `409 stale`; publish `201`; versions `200`, `400`; restore `201`, `404`; messages PUT `200`, `400 unknown_key / invalid locale / Validation failed`, `422 placeholder_mismatch (issues.expected, issues.found)`; DELETE `204`; settings PUT `200`, `400`, `409 stale`. Then `pnpm --filter @shop/api openapi && pnpm --filter @shop/admin codegen`, update `tags.ts`.

- [ ] **Step 4: Run** — `pnpm test && pnpm --filter @shop/admin typecheck` → PASS. Record the generated hook names and arg shapes in the report.

- [ ] **Step 5: Commit** — `docs(api): document the content routes in swagger; generate the admin client` (+ trailer).

---

### Task 8: Web reads live content

**Files:**

- Create: `apps/web/src/config/content.ts`, `apps/web/src/lib/content-fetch.ts` (+ test), `apps/web/src/features/content/api/get-message-overrides.ts` (+ test), `apps/web/src/i18n/apply-overrides.ts` (+ test)
- Modify: `apps/web/src/features/rules/api/get-rules.ts` (+ test), `apps/web/src/features/site-settings/api/get-site-settings.ts` (+ test), `apps/web/src/i18n/request.ts`, `apps/web/src/app/[locale]/rules/page.tsx` (null → unavailable state, if not already), `.env.example` (`CONTENT_REVALIDATE_SECONDS`)
- Delete: `apps/web/src/features/rules/data/rules.en.ts`, `rules.pl.ts`, `rules.test.ts` (the demo now lives in the API seed) — only after the page no longer imports them

**Interfaces:**

- Consumes: `PublicRulesSchema`, `SiteSettingsSchema`, `PublicMessagesSchema`, `isEditableKey`.
- Produces: `CONTENT_REVALIDATE_SECONDS: number` (env, positive int, default 60); `contentFetch<T>(path: string, schema, tag: string): Promise<T>` (throws on non-2xx except it returns `null` for 404 when asked — see code); `getRules(locale): Promise<PublicRules | null>` (null on 404 _and_ on any failure, logged); `getSiteSettings(): Promise<SiteSettings>` (defaults on failure); `getMessageOverrides(locale): Promise<Record<string,string>>` (`{}` on failure); `applyOverrides(messages, overrides): AbstractIntlMessages` (deep copy, ignores orphans and non-allowlisted keys).

- [ ] **Step 1: Write the failing tests**

`apply-overrides.test.ts`:

```ts
import {applyOverrides} from './apply-overrides'

describe('applyOverrides', () => {
  const file = {hero: {title: 'A', lead: 'B'}, cart: {title: 'C'}}

  it('replaces allowlisted keys in a copy', () => {
    const out = applyOverrides(file, {'hero.title': 'X'})
    expect(out).toEqual({hero: {title: 'X', lead: 'B'}, cart: {title: 'C'}})
    expect(file.hero.title).toBe('A')
  })

  it('ignores orphans and keys outside the allowlist', () => {
    expect(applyOverrides(file, {'hero.gone': 'X', 'cart.title': 'Y'})).toEqual(file)
  })
})
```

`get-rules.test.ts`, `get-site-settings.test.ts`, `get-message-overrides.test.ts` (mock `global.fetch`):

```ts
// get-site-settings.test.ts
import {DEFAULT_SITE_SETTINGS} from '@/config/site'

import {getSiteSettings} from './get-site-settings'

describe('getSiteSettings', () => {
  it('returns the API settings and asks Next to cache them with the content tag', async () => {
    const live = {
      siteName: {plain: 'Mine', accent: 'craft'},
      serverIp: 'play.example.com',
      discordUrl: 'https://discord.gg/x',
      supportEmail: 'a@b.co'
    }
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(live))
    await expect(getSiteSettings()).resolves.toEqual(live)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/content\/settings$/),
      expect.objectContaining({next: {revalidate: 60, tags: ['content-settings']}})
    )
  })

  it.each([
    ['a 500', () => Promise.resolve(new Response('x', {status: 500}))],
    ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['an invalid body', () => Promise.resolve(Response.json({nope: true}))]
  ])('falls back to the defaults on %s', async (_label, impl) => {
    jest.spyOn(global, 'fetch').mockImplementation(impl)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS)
  })
})
```

`get-rules.test.ts`: 200 → parsed rules; 404 → `null` without logging an error; 500/network → `null` (logged). `get-message-overrides.test.ts`: 200 → map; failure → `{}`.

`content.ts` test: `CONTENT_REVALIDATE_SECONDS` reads the env (`'1'` → 1), defaults to 60, refuses `'0'`/`'abc'` (falls back to 60 with a console warning, never breaks the build).

- [ ] **Step 2: Run** — `pnpm --filter @shop/web test -- content overrides get-rules get-site-settings` → FAIL.

- [ ] **Step 3: Implement**

`config/content.ts`:

```ts
const raw = process.env.CONTENT_REVALIDATE_SECONDS
/** How long the web keeps site content before refetching it (ADR 0007/0008). e2e sets 1. */
export const CONTENT_REVALIDATE_SECONDS = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : 60
```

`lib/content-fetch.ts`:

```ts
import {CONTENT_REVALIDATE_SECONDS} from '@/config/content'
import * as v from 'valibot'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

/** Cached GET of a public content route; throws on any failure so Next never caches an error. 404 → null. */
export async function contentFetch<S extends v.GenericSchema>(
  path: string,
  schema: S,
  tag: string
): Promise<v.InferOutput<S> | null> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    next: {revalidate: CONTENT_REVALIDATE_SECONDS, tags: [tag]},
    signal: AbortSignal.timeout(5000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${path} ${String(res.status)}`)
  return v.parse(schema, await res.json())
}
```

`get-rules.ts`: `try { return await contentFetch(`/api/content/rules?locale=${locale}`, PublicRulesSchema, 'content-rules') } catch (e) { console.error(e); return null }` (keep the existing JSDoc updated to ADR 0007/0008). `get-site-settings.ts`: same, `null`/failure → `DEFAULT_SITE_SETTINGS`. `get-message-overrides.ts`: same, failure/null → `{}`.

`apply-overrides.ts`:

```ts
import type {AbstractIntlMessages} from 'next-intl'

import {isEditableKey} from '@shop/messages'

/** File messages with admin overrides written in; unknown and non-editable keys are ignored (spec §6.3). */
export function applyOverrides(
  messages: AbstractIntlMessages,
  overrides: Record<string, string>
): AbstractIntlMessages {
  const out = structuredClone(messages)
  for (const [key, value] of Object.entries(overrides)) {
    if (!isEditableKey(key)) continue
    const path = key.split('.')
    let node: Record<string, unknown> = out
    for (const part of path.slice(0, -1)) {
      const next = node[part]
      if (typeof next !== 'object' || next === null) {
        node = {}
        break
      }
      node = next as Record<string, unknown>
    }
    const last = path.at(-1) ?? ''
    if (typeof node[last] === 'string') node[last] = value
  }
  return out
}
```

`request.ts`: after picking the file messages, `const overrides = await getMessageOverrides(locale)` and `return {locale, messages: applyOverrides(file, overrides)}`. The `[locale]` layout already renders per request (`await connection()`), so no build-time fetch happens; confirm `pnpm --filter @shop/web build` passes with no API running.

Rules page: when `getRules` returns `null`, render the existing `rules.unavailable` message (it is in the messages already) instead of the view; header and footer still render.

- [ ] **Step 4: Run** — `pnpm --filter @shop/web test && pnpm --filter @shop/web typecheck && pnpm --filter @shop/web build` → PASS (build without API).

- [ ] **Step 5: Commit** — `feat(web): rules, texts and brand settings from the content api with fallbacks` (+ trailer).

---

### Task 9: Admin: content navigation, settings page, texts page

**Files:**

- Modify: `apps/admin/src/config/nav.ts` (+ `{href: '/content/rules', label: 'Content', permission: 'content.write'}` — the nav marks `/content/...` current; add the two sub-links as tabs on each content page instead of more nav items), `apps/admin/src/lib/api/error-message.ts` (+ `not_published`, `unknown_key`, `placeholder_mismatch` → "Keep the same {placeholders} and <tags> as the original: …" built from `issues.expected`)
- Create: `apps/admin/src/features/content/components/content-tabs.tsx` (links Rules / Texts / Settings), `settings-form.tsx` (+ test), `texts-table.tsx` (+ test), `apps/admin/src/features/content/schemas.ts`
- Create: `apps/admin/src/app/(shell)/content/settings/page.tsx`, `apps/admin/src/app/(shell)/content/texts/page.tsx` (both `requireMe()` + `notFound()` without `content.write`)

**Interfaces:**

- Consumes: Task 7 hooks; `apiErrorMessage`; version-in-a-ref pattern from `features/catalog/components/server-editor.tsx`.

Behaviour (the tests pin the labelled parts):

1. **Settings form** — fields "Site name", "Accent part" (with a live wordmark preview: plain text then the accent part in the accent colour), "Server address", "Discord link", "Support email"; Save sends `{...values, version}` with the version kept in a ref (from load and successful saves); 409 shows "Someone else changed this…" and keeps the typed values; success "Saved. Live on the site within a minute." (`role="status"`); field errors accessible.
2. **Texts table** — locale switch EN/PL (tabs); search box "Search texts" filtering by key and by text; rows grouped by `namespace` with a heading; each row: key (mono), default text, an input (Textarea for texts longer than 80 chars) labelled `Override for <key>` prefilled with the override, a "changed" badge when an override exists, Save (per row) and Reset (only when overridden; DELETE). A 422 shows the API message under that row's input; other rows keep their state.

Tests (`settings-form.test.tsx`, `texts-table.test.tsx`, mock `fetch` like the 3b component tests):

```tsx
// texts-table.test.tsx (core cases)
it('saves one override and shows the placeholder error under that row only', async () => {
  // GET list returns hero.title (no override) and rules.title (override "X <accent>y</accent>")
  // PUT rules.title answers 422 {message:'placeholder_mismatch', issues:{expected:['<accent>'], found:[]}}
  // type into "Override for rules.title", click its Save → alert under that row mentions <accent>
  // "Override for hero.title" has no error
})
it('filters by the search box across key and text', async () => {
  /* type "accent" → only rules.title row visible */
})
it('resets an override with DELETE and the badge disappears', async () => {
  /* … */
})
```

```tsx
// settings-form.test.tsx (core cases)
it('previews the wordmark and saves with the loaded version', async () => {
  /* PUT body has version 3 */
})
it('keeps the loaded version after a 409 (two saves both send version 3)', async () => {
  /* … */
})
it('shows field errors for a bad email and an http discord link', async () => {
  /* … */
})
```

Write every listed test body in full (no `…` left) in the same style as `apps/admin/src/features/catalog/components/server-editor.test.tsx` (that file shows the fetch-mock helpers and assertions this repo uses).

- [ ] Steps: write the failing tests → run (`pnpm --filter @shop/admin test -- features/content`, FAIL) → implement → run (PASS) + `pnpm --filter @shop/admin build` → commit `feat(admin): content settings and texts pages` (+ trailer).

---

### Task 10: Admin: rules editor

**Files:**

- Create: `apps/admin/src/features/content/components/rules-editor.tsx` (+ test), `rules-preview.tsx` (+ test), `versions-list.tsx` (+ test), `apps/admin/src/features/content/lib/rules-form.ts` (+ test: document ⇄ form, new ids)
- Create: `apps/admin/src/app/(shell)/content/rules/page.tsx`

**Interfaces:**

- Consumes: Task 7 hooks (`useGetRulesDraftQuery`, `useSaveRulesDraftMutation`, `usePublishRulesMutation`, `useListRulesVersionsQuery`, `useRestoreRulesVersionMutation`), `SortableList`, `parseInline` from `@shop/shared/rules`, `RulesDocumentSchema` for client validation.

Behaviour:

1. Loads the draft; form state = the document; the `revision` lives in a ref (from load and from each successful save/restore result).
2. Sections are a `SortableList` (label "Sections", handles "Move <section EN title>"); inside each section the items are a `SortableList` (label "Rules in <title>", handles "Move rule <n>"). Add section / add rule / delete (with an inline confirm) buttons. New ids: `slug(title)` for sections, `<sectionId>-<n>` for items, unique within the document (`rules-form.ts`).
3. Each text field has EN/PL tabs (as in the product editor; tab triggers outside any disabled fieldset; invalid submit switches to the tab with the first error). An empty PL field shows the hint "Uses the English text".
4. Live preview pane (`rules-preview.tsx`): numbered sections `1.`, items `1.1` …, the text rendered from `parseInline` (bold, italic, links; unsafe links appear as plain text), with an EN/PL switch showing the fallback.
5. "Save draft" sends `{content, revision}`; 409 → "Someone else changed the draft. Reload to see their version." and the form keeps its content; unsafe links/limits are caught client-side by `RulesDocumentSchema` and shown at the field.
6. "Publish" is enabled only when the draft is saved (no unsaved changes); it opens an inline confirmation "Publish as the edition of <today's date in Europe/Warsaw>?" → `publishRules` → status "Published. Visible on the site within about a minute."
7. Versions list (`versions-list.tsx`): newest first, "Load more" with `cursor`, each row shows date (Europe/Warsaw), author, and "Restore to draft" (confirm) → replaces the form content and the revision.

Tests (write in full in the server-editor test style):

```tsx
// rules-editor.test.tsx
it('saves the draft with the loaded revision and keeps it after a 409 (two saves send revision 4)', …)
it('refuses an unsafe link client-side and shows it at the field', …)
it('adding a section and a rule gives unique ids', …)
it('publish is disabled while there are unsaved changes', …)
// rules-preview.test.tsx
it('numbers sections and items and falls back to EN in the PL view', …)
it('renders [x](javascript:…) as plain text', …)
// versions-list.test.tsx
it('loads the next page with the cursor and restores a version after confirming', …)
// rules-form.test.ts
it('round-trips a document and creates unique ids', …)
```

Write every listed test body in full (no `…` left), in the style of `server-editor.test.tsx`; each named case must assert exactly the behaviour in its title. Keyboard drag is covered by e2e (Task 11), as in 3b.

- [ ] Steps: failing tests → run (FAIL) → implement → run (PASS) + `pnpm --filter @shop/admin build` → commit `feat(admin): rules editor with drag and drop, preview, publish and versions` (+ trailer).

---

### Task 11: e2e, configuration and docs

**Files:**

- Modify: `e2e/tests/admin.spec.ts` (two new serial tests at the end, using `ownerCode`), `compose.e2e.yaml` (web: `CONTENT_REVALIDATE_SECONDS: '1'`), `apps/web/Dockerfile`/compose if `CONTENT_REVALIDATE_SECONDS` must be passed at runtime (it is read on the server at runtime)
- Create: `docs/adr/0008-site-content-in-the-database.md`
- Modify: `docs/runbooks/deploy.md` (shop-web env `CONTENT_REVALIDATE_SECONDS` optional; migrations note for `content_write_permission`; seed now also creates the first rules edition and settings — on an already-seeded prod run `node dist/seed/main.js` again? No: `seedContent` is idempotent and creates only missing rows, so running the seed once more after deploy is safe and needed to create the settings row and first edition — say this explicitly), `docs/guides/deploy-from-scratch.md` (same, beginner wording), `CLAUDE.md` (content bullet), `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md` (roadmap: site content phase 2 done in 3c; ISR wording → ADR 0007/0008)

Behaviour of the e2e tests (both clean up in `finally`):

1. **Rule edit and publish:** owner signs in → `Content` → rules editor → change the first rule's EN text to `Probe rule <timestamp>` → Save draft → Publish → confirm → open the storefront `/rules` and poll (bounded, 30 s) until the text is visible. Cleanup: restore the previous version into the draft and publish again.
2. **Text override:** `Content` → Texts → EN → set `hero.title` to `Probe title` (keeping the original's placeholders/tags — read the default from the row and replace only plain words) → Save → home page shows it (poll, 30 s). Cleanup: Reset.

Docs: ADR 0008 records base spec §12 with the 3c change (fetch revalidate + tags per ADR 0007, env `CONTENT_REVALIDATE_SECONDS`, fallbacks).

- [ ] Steps: write the e2e tests → run on a separate stack (`docker compose -p shop-e2e -f compose.yaml -f compose.e2e.yaml up -d --build --wait`; `pnpm --filter @shop/e2e exec playwright test tests/admin.spec.ts tests/catalog.spec.ts tests/rules.spec.ts --project=chromium --workers=1`; tear down `-p shop-e2e` only; never edit /etc/hosts or `down -v` the default project) → fix tests (not product code unless it is a real bug — report it) → docs → full gate → commit `test(e2e): publish a rule and override a text from the admin; adr 0008 and docs` (+ trailer).
