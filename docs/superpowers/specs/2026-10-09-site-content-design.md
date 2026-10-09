# Site content: rules page, editable texts, brand settings

- Date: 2026-10-09
- Status: Draft, awaiting owner review
- Parent spec: `2026-10-01-minecraft-donation-shop-design.md` (adds sub-project 9, "Site content")

## 1. Goal

The owner edits three kinds of public content from the admin panel, without a deploy:

1. **Server rules page** (`/rules`, reference: `rules.png`): numbered sections and items, table of contents with item counts, search, "edition of <date>" badge.
2. **Selected UI texts** (home page hero, "how it works", FAQ, SEO title/description, ...), which today live in next-intl JSON.
3. **Brand settings**: site name, server IP, Discord URL, support email (today in `apps/web/src/config/site.ts`).

Success: an admin changes any of these in `admin`, and visitors see it on `web` within about one minute, with no deploy and no flash of old text inside one page load.

## 2. Decisions

| #   | Topic                 | Decision                                                                                                                                                                                                                                   |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Build vs buy          | In-house `content` module in `apps/api` + admin pages. No external CMS (Payload runs inside Next and breaks "logic only in api"; Directus/Strapi/Tolgee add a container and a second auth on a 4 GB VPS; Sanity/Locize are SaaS).          |
| 2   | Rules storage         | One JSON document per version, validated by a Valibot schema. Draft + publish. Every publish is an append-only version.                                                                                                                    |
| 3   | Rules item formatting | Mini-markdown: `**bold**`, `*italic*`, `[text](url)`. No raw HTML. Links only `https:` or site-relative.                                                                                                                                   |
| 4   | UI texts              | next-intl JSON files stay the source of keys, defaults and types. The DB stores **overrides** only, for keys on a code-owned allowlist. Merge happens on the server in `i18n/request.ts`.                                                  |
| 5   | FAQ                   | Stays four fixed questions (`faq.q1..q4`, `faq.a1..a4`); admin edits their text through overrides. Adding or removing questions is out of scope.                                                                                           |
| 6   | Brand settings        | `siteName` (plain + accent part), `serverIp`, `discordUrl`, `supportEmail` move to one DB row. Saved immediately, no draft.                                                                                                                |
| 7   | Caching               | `web` reads through `'use cache'` functions with `cacheTag` and a custom `cacheLife` profile `content` (`stale: 30, revalidate: 60, expire: 3600`). No on-demand revalidation endpoint, no Redis for content. Changes appear within ~60 s. |
| 8   | Build in CI           | Content is never fetched at build time. Routes that read content render at request time; the cached data makes that cheap.                                                                                                                 |
| 9   | Enforcement           | Cached content is for display only. Anything that must be enforced is checked by `api` on the request that needs it.                                                                                                                       |
| 10  | Delivery              | Two phases. Phase 1 (now): rules page on local data behind the final read interface. Phase 2 (after sub-projects 2 and 3): DB, api, admin, live data.                                                                                      |

## 3. Architecture

```
admin (Next, EN)               api (NestJS, module `content`)                web (Next, EN/PL)
────────────────               ──────────────────────────────                ─────────────────
Rules editor        ──PUT──►   /api/admin/content/rules/*      ──►  Postgres
Site texts          ──PUT──►   /api/admin/content/messages/*        (permission content.write,
Settings form       ──PUT──►   /api/admin/content/settings           audit log on every write)

                               /api/content/rules?locale=      ◄──  getRules(locale)            tag `rules`
                               /api/content/messages?locale=   ◄──  getMessageOverrides(locale) tag `messages`
                               /api/content/settings           ◄──  getSiteSettings()           tag `settings`
```

- `api` is the only writer and the only validator.
- `web` only reads, through three cached functions. Components keep calling `t('…')`; rules and settings components call the functions above.
- `packages/messages` (`@shop/messages`): `en.json`, `pl.json`, `EDITABLE_MESSAGES`. Shared by `web` (defaults), `api` (allowlist and placeholder checks) and `admin` (field list with defaults).
- `packages/shared` (`@shop/shared`, ADR 0006): Valibot schemas for the rules document, settings and override payloads, used by `api` and `admin` forms.
- Mini-markdown renderer `RichText` lives in `@shop/ui`, so the admin preview and the site render identically. It wraps `react-markdown` (no raw HTML by default) with `allowedElements: ['p', 'strong', 'em', 'a']`, `unwrapDisallowed`, and a `urlTransform` that drops anything but `https:` and `/` links.

## 4. Data model (Prisma, phase 2)

```prisma
model RulesDraft {
  id        Int      @id @default(1)   // single row
  content   Json                         // RulesDocument
  revision  Int      @default(0)         // optimistic concurrency
  updatedAt DateTime @updatedAt
  updatedBy String
}

model RulesVersion {
  id          Int      @id @default(autoincrement())
  content     Json                       // RulesDocument, frozen
  publishedAt DateTime @default(now())
  publishedBy String
  @@index([publishedAt])
}

model MessageOverride {
  locale    Locale
  key       String                       // e.g. "hero.title"
  value     String
  updatedAt DateTime @updatedAt
  updatedBy String
  @@id([locale, key])
}

model SiteSettings {
  id             Int      @id @default(1)   // single row
  siteNamePlain  String
  siteNameAccent String
  serverIp       String
  discordUrl     String
  supportEmail   String
  updatedAt      DateTime @updatedAt
  updatedBy      String
}
```

`RulesDocument` (Valibot schema in `@shop/shared`):

```ts
type RulesDocument = {
  sections: {
    id: string // stable, for anchors and React keys
    title: {en: string; pl?: string}
    items: {id: string; text: {en: string; pl?: string}}[]
  }[]
}
```

Why JSON instead of `*_translations` tables (parent spec §5): rules are a document edited and published as a whole, never queried by field, and ~100 items. A JSON snapshot per version gives draft/publish and history with two tables and no row-level diffing. Recorded in ADR 0007.

Numbering is positional and computed on read (`1`, `1.1`, ...); admins never type numbers. Missing `pl` text falls back to `en` (parent spec rule).

## 5. API (phase 2)

Public, no auth, `Cache-Control: no-store` (web does the caching):

| Endpoint                            | Returns                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/content/rules?locale=`    | Latest published version, localized with fallback: `{publishedAt, sections: [{id, title, items: [{id, text}]}]}`, where `title` and `text` are `{value, lang}` (`lang` is `en` when PL fell back); `404` if never published |
| `GET /api/content/messages?locale=` | `{[key]: value}` overrides for that locale (flat keys)                                                                                                                                                                      |
| `GET /api/content/settings`         | Settings row                                                                                                                                                                                                                |

Admin, `@RequirePermission('content.write')`, every write goes to the audit log:

| Endpoint                                             | Purpose                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `GET /api/admin/content/rules/draft`                 | Draft + `revision`                                       |
| `PUT /api/admin/content/rules/draft`                 | Replace draft; body carries `revision`; mismatch → `409` |
| `POST /api/admin/content/rules/publish`              | Copy draft into a new `RulesVersion`                     |
| `GET /api/admin/content/rules/versions`              | List (id, publishedAt, publishedBy), keyset paginated    |
| `POST /api/admin/content/rules/versions/:id/restore` | Copy a version into the draft (does not publish)         |
| `GET /api/admin/content/messages?locale=`            | Allowlisted keys with default, override and flags        |
| `PUT /api/admin/content/messages/:locale/:key`       | Upsert override                                          |
| `DELETE /api/admin/content/messages/:locale/:key`    | Reset to default                                         |
| `GET`/`PUT /api/admin/content/settings`              | Read / replace settings                                  |

Validation (api, trust boundary):

- Rules: Valibot schema; title ≤ 120 chars, item text ≤ 2000 chars, ≤ 50 sections, ≤ 100 items per section; markdown links must be `https:` or start with `/`.
- Message override: key must match `EDITABLE_MESSAGES` (else `403`); value must parse as ICU (`intl-messageformat` parser) and contain exactly the same argument names and rich-text tags as the default (else `422`); ≤ 2000 chars.
- Settings: `serverIp` is a hostname or IP with optional port; `discordUrl` is `https:`; `supportEmail` is an email; name parts 1–24 chars.

Permission `content.write` is added to the code-defined permission list (parent spec §7); `OWNER` and seeded `ADMIN` get it.

## 6. Web

### 6.1 Rules page `/[locale]/rules`

Matches `rules.png`, in the site's visual language:

- Header: "Server rules" with the second word in the accent colour, lead text, badge "Current edition: <publishedAt>" (localized date).
- Left column: search input (`/` focuses it), table of contents with section number, title and item count; the section in view is highlighted (IntersectionObserver).
- Right column: one card per section, header with number, title and "N items", items as `1.1 text`.
- Anchors: `#s-<n>` per section, `#r-<n>-<m>` per item, so a moderator can link "rule 2.3". Anchors follow the displayed number on purpose (players cite rules by number); after a reorder an old link points to whatever is now 2.3. Opening a URL with an anchor clears any search, scrolls the item into view (`scroll-margin-top` clears the navbar) and highlights it for 2 s.
- Search filters client-side over the already loaded text (both titles and items), shows matches with the term highlighted, and shows an empty state with a "clear search" button when nothing matches. Data is small; no server search. Matching rules are in §6.5.
- Mobile: contents collapse into a `MorphPopover` trigger above the list (CLAUDE.md rule for expanding panels).
- All texts of the page chrome are next-intl keys in a `rules` namespace (§6.5); `rules.title` and `rules.lead` are on the allowlist.

#### Rule actions: copy text, copy link

Each item has two icon buttons on its right edge:

| Button    | Copies                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Copy text | `2.3. <item text as plain text>` in the current locale (markdown stripped, link text kept, URL dropped) |
| Copy link | Absolute URL in the current locale: `<origin>/<locale>/rules#r-2-3`                                     |

- Visibility: hidden until the item is hovered or anything inside it has keyboard focus (`group-hover`, `group-focus-within`); always visible, muted, on devices without hover (`@media (hover: none)`). Buttons stay in the tab order, so keyboard users reach them without hovering.
- Feedback: the clicked icon turns into a check for 2 s and a visually hidden `aria-live="polite"` region announces "Copied" / "Link copied". If `navigator.clipboard.writeText` rejects or is missing, the region announces "Couldn't copy" and the icon shows an error state; nothing else on the page changes.
- Labels: `aria-label` and tooltip "Copy rule 2.3" / "Copy link to rule 2.3", localized with the number as an ICU argument.
- Copying does not change the URL or scroll position.

Structure (ADR 0004): `features/rules/` with `api/get-rules.ts`, `components/rules-toc.tsx`, `components/rules-section.tsx`, `components/rule-item.tsx`, `components/rule-actions.tsx`, `components/rules-search.tsx`, `hooks/use-copy.ts`, `lib/number-rules.ts`, `lib/filter-rules.ts`, `lib/normalize-search.ts`, `lib/rule-plain-text.ts`, `lib/rule-anchor.ts`; route in `app/[locale]/rules/page.tsx`.

### 6.2 Cached reads

```ts
// features/rules/api/get-rules.ts (phase 2 body)
export async function getRules(locale: Locale) {
  'use cache'
  cacheTag('rules')
  cacheLife('content')
  const res = await fetch(`${API_ORIGIN}/api/content/rules?locale=${locale}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`rules ${res.status}`) // throw, so a failure is never cached
  return parse(PublicRulesSchema, await res.json())
}
```

Same shape for `getSiteSettings()` (`features/site-settings/api/`) and `getMessageOverrides(locale)` (`i18n/`).

- `next.config.ts`: `cacheComponents: true`, `cacheLife: {content: {stale: 30, revalidate: 60, expire: 3600}}`.
- Routes that read content opt out of build-time prerendering (`await connection()` before the read, with the route allowed to block via `export const instant = false`), so the HTML arrives complete with no fallback flash and CI never calls the api. Because overrides feed every page through `request.ts`, in practice every `[locale]` route renders per request from cached data. Task 1 of phase 2 is a spike that confirms this with `next build` and measures TTFB; if it fails, the fallback is to keep only `/rules` and settings live and apply overrides at the layout level.
- On a fetch error during revalidation Next keeps serving the previous entry until `expire`. When there is no entry at all: rules page shows a localized "Rules are temporarily unavailable" state; settings fall back to the values currently in `config/site.ts` (kept as `DEFAULT_SITE_SETTINGS`); overrides fall back to `{}` (file texts).

### 6.3 Overrides merge

```ts
// i18n/request.ts
const file = (await import(`@shop/messages/${locale}.json`)).default
const overrides = await getMessageOverridesSafe(locale) // catches outside the cached fn: {} on failure, failure never cached
return {locale, messages: applyOverrides(file, overrides)}
```

`applyOverrides` writes each flat key into a deep copy of the file messages and ignores keys that are not in the file (orphans). `pickClientMessages` runs on the merged result, so client namespaces get overrides too.

### 6.4 Settings consumers

`SITE_NAME`, `SERVER_IP`, `DISCORD_URL` imports in components are replaced by `getSiteSettings()` in Server Components, passed down as props where a Client Component needs them (IP copy button). `config/site.ts` keeps `PAGES`, `LEGAL_DOCS`, `legalPath` and `DEFAULT_SITE_SETTINGS`.

### 6.5 Languages (EN, PL)

Every feature of the rules page works the same in both locales; nothing is English-only on the public side.

- **Routes and SEO:** `/en/rules` and `/pl/rules`; `generateMetadata` uses localized `rules.metaTitle` / `rules.metaDescription`; `hreflang` alternates for both plus `x-default` → `en`; `/rules` added to `app/sitemap.ts` for both locales.
- **Content:** demo rules exist in both languages (phase 1 data files, phase 2 seed). Admin edits EN and PL per field. A PL field left empty falls back to EN; the public API then returns that field as `{value, lang: 'en'}` and `web` puts `lang="en"` on that element so screen readers switch voice. Fields in the requested locale carry `lang` equal to it.
- **Chrome strings** (`rules` namespace, EN/PL, covered by the existing key-parity check): `title`, `lead`, `metaTitle`, `metaDescription`, `edition` (`Current edition: {date}`), `contents`, `openContents`, `searchPlaceholder`, `searchShortcut`, `itemCount`, `noResults` (`No rules match "{query}"`), `clearSearch`, `unavailable`, `copyText` (`Copy rule {number}`), `copyLink` (`Copy link to rule {number}`), `copied`, `linkCopied`, `copyFailed`.
- **Plurals:** `itemCount` is ICU plural. EN `one/other`; PL `one/few/many/other` (1 punkt, 2–4 punkty, 5+ punktów, 22 punkty).
- **Dates:** the edition badge formats `publishedAt` with next-intl `format.dateTime(date, {dateStyle: 'long'})` in the page locale (EN "28 May 2026", PL "28 maja 2026").
- **Search:** case-folding with `toLocaleLowerCase(locale)` and diacritic-insensitive matching: each character is normalized on its own (NFD, combining marks removed, `ł`→`l`), keeping a map back to original indices so highlighting marks the original text. "zolw" finds "żółw"; "Zolw" finds "Żółw".
- **Copy:** copy text uses the displayed locale's text (including the EN fallback if that is what is shown); copy link includes the current locale segment.
- **Language switch:** switching locale on `/rules` keeps the hash, so the reader stays on the same rule (anchors are numbers, identical in both languages).
- **Keyboard:** the `/` shortcut checks `event.key === '/'`, so it works on EN and PL layouts, and is ignored while focus is in an input or textarea.

## 7. Admin (phase 2, EN)

Pages under the admin shell from sub-project 3, guarded by `content.write`. Forms follow ADR 0006.

1. **`/content/rules`**: draft editor. Sections as an ordered list (move up/down buttons, add, delete with confirmation), items inside each section the same way. EN/PL tabs per text field; PL fields show "uses EN" when empty. Live preview pane with the shared `RichText` and computed numbering. Save draft (shows `409` as "someone else changed the draft, reload"). Publish button with confirmation showing the new edition date. Versions list with "restore to draft". Hint: "Visible on the site within about a minute."
2. **`/content/texts`**: allowlisted keys grouped by namespace, search, EN/PL columns. Each row shows the file default, the override input, "changed" badge and "reset". Validation errors from the api (placeholder mismatch) shown per field.
3. **`/content/settings`**: four fields, save, same "within a minute" hint.

Admin reads go straight to the api with no caching, so the admin always sees what it saved.

## 8. Allowlist (`packages/messages/src/editable.ts`)

```ts
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
```

Excluded on purpose: `hero.left1..right2` (layout-cut words of the decorative headline), status/aria labels, navigation labels, and the `nav`, `cart`, `checkout`, `catalog`, `product`, `consent` namespaces (shop UI and legally relevant consent wording). Adding a key is a code change.

## 9. Phases and order

### Phase 1: rules page on local data (no dependencies, start now)

1. `features/rules` data types and `number-rules`, `filter-rules` with unit tests.
2. Local data `features/rules/data/rules.en.ts` and `rules.pl.ts` (demo rules in the shape of the public API response, with a fixed `publishedAt`); `getRules(locale)` returns it.
3. `RichText` mini-markdown renderer in `@shop/ui` with tests (bold, italic, safe links, no HTML).
4. Rules page UI: header, TOC with scroll highlight, sections, anchors with highlight on open, search (locale-aware, diacritic-insensitive), mobile `MorphPopover`.
5. Rule actions: copy text and copy link with feedback and live region.
6. Languages: `rules` messages EN/PL (plurals, date, labels), `lang` on fallback fields, metadata + hreflang + sitemap, hash kept on locale switch.
7. `getSiteSettings()` returning `DEFAULT_SITE_SETTINGS`; components switch from constants to it.

Phase 1 ships a finished `/rules` page; phase 2 changes only function bodies on the web side.

### Phase 2: live content (after sub-projects 2 and 3)

1. Spike: `cacheComponents` + request-time rendering of `[locale]` routes; confirm `next build` passes without api and TTFB is acceptable.
2. Move messages to `@shop/messages`; add `EDITABLE_MESSAGES`; keep the EN/PL key-parity check.
3. Prisma models + migration + seed (phase 1 demo rules become the seed's first published version; settings seeded from current values).
4. `content` module: public endpoints, admin endpoints, validation, permission, audit.
5. `web`: real bodies for `getRules`, `getSiteSettings`, `getMessageOverrides`; overrides merge; fallbacks.
6. `admin`: settings page, texts page, rules editor with preview, publish and versions.
7. ADR 0007 and parent spec updates (sub-project 9 in the roadmap, ISR wording in §11 replaced by `'use cache'`).

## 10. Testing

| Layer                     | What                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (web, Jest)          | numbering, search filter, `normalize-search` (PL diacritics, `ł`, index map for highlight), `rule-plain-text`, `rule-anchor`, `applyOverrides` (deep set, orphans ignored), `RichText` (no HTML, `javascript:` links dropped) |
| Component (web)           | rule actions: copy text/link call the clipboard with the expected strings in EN and PL, check icon + live region on success, error announcement on rejection; `itemCount` plural forms for PL 1/2/5/22                        |
| Unit (api, Jest)          | rules schema limits, ICU placeholder equality, allowlist matching (`ns.*`), settings validation                                                                                                                               |
| Integration (api)         | Testcontainers Postgres: draft `409` on stale revision, publish creates version, restore, public endpoint fallback `pl → en`, audit rows written                                                                              |
| E2E (Playwright, phase 1) | `/pl/rules#r-2-3` scrolls to and highlights 2.3; search "zolw" in PL finds the item; copy link on `/pl/rules` yields `/pl/rules#r-…`; switching to EN keeps the hash                                                          |
| E2E (Playwright)          | admin edits a rule and publishes → `/rules` shows it (test env sets `revalidate` to 1 s via env-driven profile); admin overrides `hero.title` → home shows it                                                                 |
| Build check (CI)          | `next build` of `web` with no api reachable succeeds                                                                                                                                                                          |

## 11. Out of scope

- Adding or removing FAQ questions, "how it works" steps, or any other repeating block.
- On-demand cache revalidation (`revalidateTag` endpoint); can be added later with one route and an ADR, tags are already in place.
- Shared cache handler (Redis) for multiple `web` instances.
- Scheduled publishing, approval workflow, per-field history for texts and settings.
- WYSIWYG editor, images inside rules.
- Maintenance mode, shop on/off switch, announcement banner.

## 12. ADR to write

**ADR 0007: Site content in the database.** Brand values move from `config/site.ts` (ADR 0005) to the DB with `DEFAULT_SITE_SETTINGS` as fallback; rules as versioned JSON documents; UI texts as allowlisted overrides on top of next-intl files; caching via `'use cache'` + `cacheLife('content')` without on-demand revalidation. ADR 0005 stays valid for everything else in `config/`.
