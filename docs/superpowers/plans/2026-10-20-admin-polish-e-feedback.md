# Admin Polish E — Feedback Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run `graphify query` before grepping; run `graphify update .` after editing code.

**Goal:** Fix the 19 issues from the 2026-10-20 admin review (bugs, motion, toasts, RCON gate, icon model, audit paging).

**Architecture:** Mostly admin UI fixes inside existing components (`apps/admin/src/components/`, `features/*`). Three API changes: purchases require a usable RCON (`orders` + public catalog contract), the product icon moves to the category (Prisma migration), audit gets a page-based pager on top of the existing keyset cursor. One new dependency: `sonner` for toasts in admin.

**Tech Stack:** Next 16, React 19, Motion 13, Tailwind 4, Radix, RTK Query (codegen from `apps/api/openapi.json`), NestJS, Prisma 7, valibot, Jest, Playwright.

**Spec:** the user's review list (below, "Source") + `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`, `DESIGN.md`, ADRs in `docs/adr/`.

## Source (user review, 2026-10-20)

1. Content → Rules: language tabs switch EN→PL, but PL→EN does nothing.
2. A server with no RCON configured must not sell (memory `checkout-requires-rcon`).
3. The icon chosen on a product really belongs to the category → move it to the category.
4. Green focus ring visible on pill navigations (rail, sub-nav, 7d/30d, currency, language); range switch should animate the whole dashboard.
5. Skeleton: closer to the real layout, less flashing (min delay).
6. Rail nav indicator waits for the next page to load; must move at click.
7. Latest orders: whole row clickable, not only the id.
8. "Back to …" buttons on the left.
9. Toasts for copy, save, errors.
10. Emails say "Shop Admin" → use the site name (BlockHaus).
11. `/catalog` → click a product: rail indicator replays its enter animation from below.
12. Selected server card ring is crooked.
13. Product card hover: no underline on the name.
14. Audit log: pagination, works at 10 000+ rows, filter by actor.
15. Better design for "Attach category".
16. Mobile burger menu animation.
17. Search engines must not index the admin.
18. Product editor preview also shows the description.
19. Product editor "additional section" block always has a white border.

## Global Constraints

- Business logic only in `apps/api`; Next apps have no route handlers.
- Money is `amountMinor: Int` + `currency`; prices recomputed from the DB.
- Do not bump ESLint (9) or TypeScript (6) majors.
- Admin strings in `apps/admin/messages/{en,pl}.json` with identical key sets; API errors translated by code (`apiErrors.*`).
- Every admin route documented in `apps/api/src/openapi/` (`operationId`, `tags`, `summary`, `description`, response descriptions); after API changes run `pnpm --filter @shop/admin codegen`.
- Admin UI uses `apps/admin/src/components/` and tokens in `apps/admin/src/app/globals.css`; no horizontal scroll at 390 px; status = dot + label.
- Motion respects `prefers-reduced-motion` (no movement, opacity only or none).
- TDD; before each commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm test:int` where Docker runs).
- Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Unsure about a library API (sonner, Motion `layoutRoot`/`layoutDependency`, Prisma index `ops`) → Context7 first.

## Review Focus

1. Cart already holding a product whose server lost RCON → `POST /api/orders` answers 409 `unavailable` with that line; storefront shows it unavailable, not a 500 (Task 2).
2. Migration on a DB where products of one category had different icons → category gets the most common icon, ties broken by product `sortOrder`; no category left without an icon (Task 3).
3. Audit filters changed while on page 4 → pager resets to page 1; "next" disabled on the last page (Task 4).
4. Rapid 7d↔30d↔7d clicks → the screen ends on the last chosen range's numbers, never an older response (Task 11).
5. Keyboard users still see focus on pill controls after the ring is removed (Task 9).

---

### Task 1: Rules editor — PL → EN tab switch

**Files:**

- Modify: `apps/admin/src/features/content/components/rules-editor.tsx` (and/or `packages/ui/src/tabs.tsx`, wherever the root cause is)
- Test: `apps/admin/src/features/content/components/rules-editor.test.tsx`, `e2e/tests/` (new `content-rules-tabs.spec.ts`)

The unit test "the preview follows the language tab, there and back" passes, so the failure is browser-only. Use superpowers:systematic-debugging.

- [x] **Step 1: Reproduce in a browser** — `pnpm dev`, open `http://localhost:3001/content/rules`, click PL, then EN. Record: does `onValueChange('en')` fire (temporary `console.log`), is the EN trigger covered (`document.elementFromPoint` at its centre), does focus jump into a PL `contenteditable`. Candidate causes in order: an element overlaying the tab list (sticky preview / bubble menu), a PL `RichTextField` blur/validation path calling `setTab`, Radix automatic activation fighting the controlled `value`.
- [x] **Step 2: Write the failing e2e** `content-rules-tabs.spec.ts`: sign in (existing e2e helper), go to `/content/rules`, click `tab PL` → expect `aria-selected=true`; click `tab EN` → expect EN `aria-selected=true` and `Rule 1.1 (EN)` visible. Run `pnpm test:e2e -- content-rules-tabs` → FAIL.
- [x] **Step 3: Fix the root cause**; add a unit test pinning it if it is reproducible in jsdom.
- [x] **Step 4: Run** the e2e and `pnpm --filter @shop/admin test -- rules-editor` → PASS.
- [x] **Step 5: Commit** `fix(admin): rules language tabs switch back from PL to EN`

### Task 2: No RCON, no purchase

**Files:**

- Create: `apps/api/src/catalog-admin/rcon/rcon-ready.ts` + `rcon-ready.spec.ts`
- Modify: `apps/api/src/orders/order-pricing.ts`, `order-pricing.spec.ts`, `orders.service.ts`
- Modify: `packages/shared/src/catalog.ts` (+ `catalog.spec.ts`), `apps/api/src/catalog/catalog.mapper.ts` (+ spec), `apps/api/src/catalog/catalog.service.ts`
- Modify: `apps/web/src/features/cart/components/add-to-cart.tsx`, `apps/web/src/features/catalog/components/product-card.tsx`, `product-detail.tsx`, `packages/messages` (new `catalog.unavailable` EN/PL/…)

**Interfaces:**

- Produces: `rconReady(server: {rconHost: string | null; rconPort: number | null; rconPasswordEnc: string | null}, env?: Partial<Record<string, string>>): boolean` — true only when host, port and password are set **and** `rconKey(env)` does not throw.
- Produces: `CatalogServerSchema` gains `purchasable: v.boolean()`.
- Produces: `PricingProduct.server` gains `purchasable: boolean`.

- [x] **Step 1: Failing tests**
  - `rcon-ready.spec.ts`: all set + valid key → `true`; missing host / port / password → `false`; key missing or 31 bytes → `false`.
  - `order-pricing.spec.ts`: `it('refuses a product whose server cannot deliver')` — server `purchasable: false` → `{unavailable: [{server, slug}]}`.
  - `catalog.mapper.spec.ts`: server row without RCON → `purchasable: false`; mapper output still never contains `rcon`.
- [x] **Step 2: Run** `pnpm --filter @shop/api test -- rcon-ready order-pricing catalog.mapper` → FAIL.
- [x] **Step 3: Implement.** `orders.service.ts` maps each loaded product's server through `rconReady` before `priceLines`; `priceLines` treats `!product.server.purchasable` like inactive. `catalog.service` selects the three RCON columns; the mapper emits `purchasable` and drops the columns. Do not drop products from the catalog: the storefront shows them.
- [x] **Step 4: Web.** `AddToCart` takes `purchasable: boolean`; when false renders a disabled button with `catalog.unavailable` and no cart write. Cart lines of an unpurchasable server render as unavailable (reuse the existing inactive-line UI if `loadCart` has one, otherwise mark the line and block checkout). Test in the component's `*.test.tsx`: disabled button, no `addToCart` call.
- [x] **Step 5: Run** `pnpm test` → PASS; `pnpm test:int` for orders.
- [x] **Step 6: Commit** `feat: block purchases from servers without RCON`; delete memory note `checkout-requires-rcon` after merge.

### Task 3: Icon belongs to the category

**Files:**

- Modify: `apps/api/prisma/schema.prisma` — `Category.icon ProductIcon @default(crown)`; remove `Product.icon`
- Create: `apps/api/prisma/migrations/20261020120000_category_icon/migration.sql`
- Modify: `packages/shared/src/catalog-admin.ts` (`CategoryInputSchema`, `CategoryUpdateSchema`, `AdminCategorySchema`, `CategoryRef` gain `icon`; product input/update/admin schemas lose `icon`), `apps/api/src/catalog-admin/{categories,products}.service.ts`, `products.mapper.ts`, `servers.mapper.ts`, `apps/api/src/catalog/catalog.{service,mapper}.ts`, `apps/api/src/openapi/catalog-admin-paths.ts`, `apps/api/src/seed/*`
- Modify (admin): `features/catalog/components/categories-table.tsx` (icon select in create + edit), `product-editor.tsx` (remove the icon field; preview takes the selected category's icon), `product-card.tsx`, `features/catalog/schemas.ts`, `lib/product-form.ts`, messages
- Test: `products.mapper.spec.ts`, `catalog.mapper.spec.ts`, `services.spec.ts`, `categories-table.test.tsx`, `product-editor` test, a new `category-icon.int-spec.ts` for the migration backfill

**Interfaces:**

- Public `CatalogProduct.icon` stays (web unchanged): mapper sets it from `p.category.icon`.
- Admin product list item keeps `icon` (read-only, from category) so `ProductCard` is unchanged.

- [x] **Step 1: Failing tests** — catalog mapper: product's `icon` equals its category's; admin categories service: create/update persists `icon`; product input with `icon` is rejected by the schema (`v.strictObject` or ignored — match what the schema does for unknown keys today).
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Migration SQL** — add column with default `'crown'`; backfill: `UPDATE categories c SET icon = (SELECT p.icon FROM products p WHERE p."categoryId" = c.id GROUP BY p.icon ORDER BY count(*) DESC, min(p."sortOrder") LIMIT 1) WHERE EXISTS (…)`; then drop `products.icon`. Check column names against the existing migrations before writing.
- [x] **Step 4: Implement API + seed**, update OpenAPI, `pnpm --filter @shop/admin codegen`.
- [x] **Step 5: Admin UI** — category forms get the icon `Select` (options `PRODUCT_ICONS`, each with its `ProductIcon` drawn); product editor loses the field and shows "Icon comes from the category" hint under the category select.
- [x] **Step 6: Run** `pnpm test && pnpm test:int` → PASS.
- [x] **Step 7: Commit** `feat: move the product icon to the category`

### Task 4: Audit log — pager and actor filter

Answer to "10 000 rows": the API already pages by keyset (`cursor` = last id, `ORDER BY createdAt DESC, id DESC`, indexes `[createdAt]` and `[actorId, createdAt]`), which costs the same on page 1 and page 200; `OFFSET` would not. Keep it. Add an index for the action prefix filter and a page-style UI.

**Files:**

- Modify: `apps/api/prisma/schema.prisma` — `@@index([action, createdAt(sort: Desc)])` (with `text_pattern_ops` if Prisma supports `ops` on BTree for Postgres — check Context7; otherwise raw SQL in the migration)
- Create: migration `20261020130000_audit_action_index`
- Modify: `apps/admin/src/features/audit/components/audit-table.tsx`, messages
- Test: `audit-table.test.tsx`, `apps/api/test/audit.int-spec.ts` (or the existing audit int spec)

**Interfaces:**

- Consumes: `GET /api/admin/audit?actorId=&action=&from=&to=&cursor=` (exists), admins list query from the team API (`useList…AdminsQuery`, name from `generated.ts`).

- [x] **Step 1: Failing tests** (admin): `it('pages forward and back')` — page 1 → Next → page 2 rows only, label "Page 2"; Prev → page 1 from cache; Next disabled when `nextCursor` is null. `it('filters by actor')` — options are "Anyone" (no `actorId`) + admins by email; choosing an admin sends their `actorId`. `it('resets to page 1 when filters change')`.
- [x] **Step 2: Implement** — state `cursors: (string|undefined)[]` + `pageIndex`; render one `PageRows` for `cursors[pageIndex]`; Next pushes `nextCursor` (or reuses the stored one), Prev decrements. Actor `Select` in the filter form. Int spec: 120 rows → three pages cover all ids exactly once.
- [x] **Step 3: Run** `pnpm --filter @shop/admin test -- audit-table` and `pnpm test:int` → PASS.
- [x] **Step 4: Commit** `feat(admin): audit pager and actor filter`

### Task 5: Emails use the site name

**Files:** Modify `apps/api/src/mailer/templates.tsx` (+ `templates.spec.tsx`), `apps/api/src/auth/auth.ts`, `team/invites.service.ts`, `team/admins.service.ts`, `seed/seed-access.ts`.

**Interfaces:** `signInCodeMail(code, brand)`, `inviteMail(url, roleName, brand)`, `twoFactorResetMail(brand)`; `brand = siteName.plain + siteName.accent` from `ContentService.settings()` (falls back to `DEFAULT_SITE_SETTINGS`). Better Auth `appName` / TOTP `issuer` stay static (read at boot) but use `DEFAULT_SITE_SETTINGS` instead of `'Shop Admin'`.

- [x] **Step 1: Failing test** — `inviteMail(url, 'Owner', 'BlockHaus')` subject `'You are invited to BlockHaus Admin'`; no template contains `Shop Admin`.
- [x] **Step 2: Implement**, inject `ContentService` where mails are sent.
- [x] **Step 3: Run** `pnpm --filter @shop/api test -- templates` → PASS.
- [x] **Step 4: Commit** `feat(api): emails carry the site name`

### Task 6: Admin is never indexed

**Files:** Create `apps/admin/src/app/robots.ts` (`{rules: {userAgent: '*', disallow: '/'}}`); modify `apps/admin/next.config.ts` (`headers()` → `X-Robots-Tag: noindex, nofollow` on `/:path*`). Test: `apps/admin/src/app/robots.test.ts`.

- [x] **Step 1: Failing test** — `robots()` disallows `/`; `nextConfig.headers()` includes the tag for `/:path*`.
- [x] **Step 2: Implement**; check `apps/admin/src/proxy.ts`/middleware lets `/robots.txt` through without a session.
- [x] **Step 3: Run** → PASS. After deploy: `curl -sI https://admin.glebus.app/login | grep -i x-robots`.
- [x] **Step 4: Commit** `chore(admin): disallow indexing`

### Task 7: Toasts

**Files:**

- Create: `apps/admin/src/components/toaster.tsx` (wraps `sonner`'s `Toaster`: bottom-right on desktop, top-center at < md, dark tokens, `ok`/`bad` tones as dot + label)
- Modify: `apps/admin/package.json` (`sonner`), `app/providers.tsx`, `DESIGN.md` (component table + rule: transient results → toast; validation, 409 stale and load failures stay inline)
- Modify call sites: copy buttons in `orders-table.tsx`, `order-details.tsx`; success `setStatus(...)` in `rules-editor`, `settings-form`, `texts-table`, `versions-list`, `server-editor`, `product-editor`, `categories-table`, `catalog-board`, `rcon-panel`, team components, `account-actions`; API errors after a mutation (non-409) → `toast.error`.
- Test: `toaster.test.tsx`, updated component tests (assert on `role="status"` text from the toaster)

**Interfaces:** `notify.ok(text: string)`, `notify.error(text: string)` exported from `components/toaster.tsx`; `copyText(text: string, label: string)` in `apps/admin/src/lib/copy.ts` → writes the clipboard, then `notify.ok(t('common.copied', {label}))`, or `notify.error` on rejection.

- [x] **Step 1: Failing tests** — `copyText` success → toast "Email copied"; rejected clipboard → error toast. Rules editor save → toast "Draft saved" (no inline status banner).
- [x] **Step 2: Implement** toaster + `copyText`, then migrate call sites one feature at a time; remove `useMessage` state that becomes unused.
- [x] **Step 3: Run** `pnpm --filter @shop/admin test` → PASS; check 390 px.
- [x] **Step 4: Commit** `feat(admin): toasts for copy, save and errors`

### Task 8: Skeletons that look like the page and do not flash

**Files:**

- Create: `apps/admin/src/hooks/use-delayed-flag.ts` + test
- Modify: `components/skeleton.tsx`, `app/globals.css` (`.skeleton` shimmer), `features/dashboard/components/dashboard.tsx` (`Loading`), `app/(shell)/content/loading.tsx`, `app/(shell)/catalog/(sections)/loading.tsx`, `DESIGN.md`

**Interfaces:** `useDelayedFlag(active: boolean, {delay = 200, minVisible = 400}?): boolean` — true only after `active` has held for `delay` ms; once true stays true at least `minVisible` ms.

Proposal implemented: (a) shimmer — a 1.4 s diagonal gradient sweep on `card-raised` instead of `animate-pulse` opacity blinking; static under reduced motion; (b) shapes — `SkeletonRows` rows get an inner line (60% + 20% widths) like table rows, dashboard `Loading` mirrors KPI cards (label line + big number line), chart and table; (c) delay — nothing for the first 200 ms (most cached loads finish), then at least 400 ms so it never blinks.

- [x] **Step 1: Failing tests** (fake timers) — inactive → false; active 150 ms then inactive → never true; active 250 ms → true at 200, inactive at 300 → still true until 600.
- [x] **Step 2: Implement** hook, `Skeleton` uses `.skeleton`; `SkeletonRows` and `Loading` render nothing until the flag is true (keep `role="status"` text from the start for screen readers).
- [x] **Step 3: Run** tests → PASS; visually check `/`, `/orders`, `/content/rules` with network throttled.
- [x] **Step 4: Commit** `feat(admin): shaped shimmer skeletons with a show delay`

### Task 9: Pill controls without the green ring; server card ring

**Files:** `packages/ui/src/tabs.tsx`, `apps/admin/src/components/sub-nav.tsx`, `app/(shell)/_components/nav.tsx`, `language-switch.tsx`, `features/catalog/components/server-card.tsx`, `DESIGN.md` rule 7. Tests: `sub-nav.test.tsx`, `rolling-indicator.test.tsx`, a new `tabs` class test if `packages/ui` has tests.

Decision: controls whose selection is drawn by a `RollingIndicator` (rail, sheet nav, sub-nav, tabs, language) show keyboard focus as the hover state plus an inset `focus-visible:ring-1 focus-visible:ring-fg/25` — no accent. Buttons, inputs and links elsewhere keep `ring-accent`.

- [x] **Step 1: Failing test** — rendered `SubNav` link / `TabsTrigger` / rail link class lists contain no `ring-accent`.
- [x] **Step 2: Implement** a shared `PILL_FOCUS` constant in `apps/admin/src/components/rolling-indicator.tsx` (and the same classes inline in `packages/ui/src/tabs.tsx`, which cannot import admin).
- [x] **Step 3: Server card** — the indicator radius must be the card radius + 4 px (`-inset-1`): read `--radius-card` in `globals.css` and use `rounded-[calc(var(--radius-card)+4px)]`; set `style={{borderRadius: …}}` on the `motion.span` so Motion corrects the radius during the layout animation (Context7: Motion layout borderRadius correction). Verify in the browser that the ring hugs the card in rest and in motion.
- [x] **Step 4: Run** tests → PASS.
- [x] **Step 5: Commit** `fix(admin): pill focus without the accent ring, even server ring`

### Task 10: Rail nav moves at click; no replay on catalog → product

**Files:**

- Create: `apps/admin/src/hooks/use-pending-href.ts` + test (extracted from `SubNav`)
- Modify: `components/sub-nav.tsx`, `app/(shell)/_components/nav.tsx`, possibly `components/rolling-indicator.tsx`
- Test: `apps/admin/src/app/(shell)/_components/nav.test.tsx` (new), e2e `admin-nav.spec.ts`

**Interfaces:** `usePendingHref(pathname: string): {pending: string | null; mark: (href: string) => (e: MouseEvent) => void}` — `mark` ignores modified/non-primary clicks; pending clears when the pathname changes.

- [x] **Step 1: Failing unit test** — click "Orders" in `Nav` while `usePathname` still returns `/` → Orders link has `aria-current="page"` and holds the indicator.
- [x] **Step 2: Implement** the hook, use it in `SubNav` (behaviour unchanged, its tests stay green) and `Nav` (current = pending item if any, else `isCurrent`).
- [x] **Step 3: Debug the catalog replay** (systematic-debugging): on `/catalog` click a product card; watch the rail indicator. Check in order: does the indicator unmount/remount (React DevTools / a mount `console.log`) — `(sections)` layout exit or a `Hint` re-key; does Motion see a viewport jump because the page scrolls to top while the rail is sticky/fixed → fix with `layoutRoot` on the rail container or `layoutDependency={currentHref}` on the indicator. Write the e2e first: navigate `/catalog` → product, assert the indicator's `getBoundingClientRect().top` is equal before and 100 ms after the click.
- [x] **Step 4: Run** unit + e2e → PASS.
- [x] **Step 5: Commit** `fix(admin): rail indicator moves on click and stays put inside a section`

### Task 11: Dashboard range switch animates instead of blanking

**Files:** `features/dashboard/components/dashboard.tsx` (+ `dashboard.test.tsx`), `components/day-chart.tsx`, `components/donut.tsx` / `status-donut.tsx` if they do not transition.

**Interfaces:** in `Dashboard`, `shown = query.currentData ?? (query.data && lastArgs.currency === currency ? query.data : undefined)` where the previous data is reused only when the currency is unchanged (a currency switch still must not show old-currency numbers). While `query.isFetching && shown !== query.currentData`, the content wrapper gets `aria-busy` and `opacity-60 transition-opacity`.

- [x] **Step 1: Failing test** — switch 7d → 30d with the 30d response pending: KPI cards stay mounted with 7d values and `aria-busy="true"`; no `Loading` status; on resolve values are the 30d ones. Currency switch still shows `Loading`.
- [x] **Step 2: Implement**; KPIs already count up (`useCountUp`) — make sure it animates from the previous value, not 0. Chart bars: animate `height`/`y` (SVG attributes via Motion `motion.rect` or CSS `transition` on `transform: scaleY`), 300 ms ease-out, off under reduced motion. Donut arcs transition `stroke-dasharray`.
- [x] **Step 3: Run** `pnpm --filter @shop/admin test -- dashboard` → PASS; check rapid 7d↔30d clicks end on the last range.
- [x] **Step 4: Commit** `feat(admin): animate dashboard range changes`

### Task 12: Latest orders rows are links

**Files:** `features/dashboard/components/dashboard.tsx` (`LatestOrders`), `dashboard.test.tsx`.

- [x] **Step 1: Failing test** — clicking the nick cell of a latest-order row navigates to `/orders/<id>` (mock router / assert the row link click).
- [x] **Step 2: Implement** — pass `rowHref={o => `/orders/${o.id}`}` to `DataTable`; the order cell renders plain `o.publicId` (DataTable adds the link).
- [x] **Step 3: Run** → PASS. **Step 4: Commit** `fix(admin): latest orders rows open the order`

### Task 13: Back links on the left

**Files:** `components/page-header.tsx` (+ `layout-components.test.tsx`), `features/catalog/components/editor-layout.tsx`, `features/orders/components/order-details.tsx`.

**Interfaces:** `PageHeader` gains `back?: {href: string; label: string}` — a ghost `Button asChild` with `ArrowLeft`, rendered above the title, aligned left (`-ml-3` so the icon lines up with the title).

- [x] **Step 1: Failing test** — `PageHeader` with `back` renders the link before the `h1` in DOM order.
- [x] **Step 2: Implement**; `EditorLayout` and `OrderDetails` pass `back` instead of `actions={<BackLink/>}`; delete `BackLink`.
- [x] **Step 3: Run** → PASS. **Step 4: Commit** `fix(admin): back links sit on the left`

### Task 14: Catalog editor polish

**Files:** `features/catalog/components/product-card.tsx`, `product-editor.tsx`, `sections-editor.tsx`, `catalog-board.tsx`, messages; tests next to each.

- [x] **Step 1: Tests first** — `ProductCard` link has no `group-hover:underline`; preview `ProductCard` with `description` renders it (2 lines, `line-clamp-2`, muted); sections editor block has no `border` class.
- [x] **Step 2: Hover** — remove `group-hover:underline` (the card already changes background on hover).
- [x] **Step 3: Preview description** — `ProductCard` gains optional `description?: string`, shown only when passed; the editor passes the EN description as plain text (strip markdown with the existing rich-text helper, `fromDoc`/`markdown-doc` in `components/rich-text/`).
- [x] **Step 4: Sections block** — `sections-editor.tsx:111` replace `rounded-lg border p-3` with `rounded-plate bg-card-raised p-3` (Tailwind 4 `border` defaults to `currentColor`, hence the white line). Grep admin for other bare `border` without a colour and fix the same way.
- [x] **Step 5: Attach category** — replace the label + select + button row with a compact "＋ Attach category" outline button that opens a `Select`-style menu (Radix DropdownMenu, already a dependency) listing unattached categories with their icons; choosing one attaches it at once (no second "Attach" click). Hidden when nothing is left to attach. Test: choosing a category calls `setCategories` with the appended id.
- [x] **Step 6: Run** catalog tests → PASS. **Step 7: Commit** `fix(admin): catalog editor polish`

### Task 15: Mobile menu animation

**Files:** `app/(shell)/_components/mobile-nav.tsx` (+ test), `app/globals.css` if keyframes are used.

- [x] **Step 1: Implement** — Radix Dialog with `forceMount` + Motion `AnimatePresence`: overlay fades 0 → 60% (200 ms); sheet slides from `x: -100%` with spring (`bounce: 0, duration: 0.35`, same as `RollingIndicator`); close reverses; the burger icon morphs `Menu` → `X` (rotate + crossfade, 200 ms). Reduced motion: opacity only.
- [x] **Step 2: Test** — opening renders the dialog; after closing, the dialog is removed once the exit finishes (`waitFor`).
- [x] **Step 3: Run** → PASS; check at 390 px. **Step 4: Commit** `feat(admin): animated mobile menu`

### Final

- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int && pnpm test:e2e`
- [x] `graphify update .`
- [x] Tick the boxes above; superpowers:finishing-a-development-branch.

### Task 16: Admin UI shows the site name (added 2026-10-21 at the owner's request)

Owner: replace "Shop Admin" in the browser title and on the sign-in / join pages with the site name from Content → Settings.

**Files:** Create `apps/admin/src/lib/site-name.ts` (server-only `getSiteName(): Promise<SiteSettings['siteName']>` moved out of `app/(shell)/_components/brand-mark.tsx`, same fetch: `${API_ORIGIN}/api/content/settings`, `revalidate: 60`, 3 s timeout, `DEFAULT_SITE_SETTINGS.siteName` fallback). Modify `brand-mark.tsx` (use it), `app/layout.tsx` (`generateMetadata` → title `"<plain><accent> Admin"`, keep `robots`), `apps/admin/messages/{en,pl}.json` (`signInToShopAdmin`, `joinShopAdmin`, `notInvited` take `{site}`; PL wording names the site too), the sign-in / invite components that render them. Tests: `layout.test.ts`, the auth component tests, a `site-name.test.ts` (fallback on non-OK and on throw).

- [x] **Step 1: Failing tests** — metadata title is `"Blockhaus Admin"` with default settings and `"<name> Admin"` with a mocked settings response; sign-in heading reads "Sign in to Blockhaus Admin"; no admin string contains "Shop Admin".
- [x] **Step 2: Implement**; pass the name from the server page/layout to client components as a prop (client components cannot fetch server-only).
- [x] **Step 3: Run** `pnpm --filter @shop/admin test` → PASS. **Step 4: Commit** `feat(admin): admin shows the site name`
