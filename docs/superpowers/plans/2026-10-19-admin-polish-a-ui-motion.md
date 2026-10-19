# Admin polish A — UI fixes, tooltips, motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement parts 1–5 and 9 of the admin polish spec: whole-plate clicks, server/category edit pencils, Catalog/Content sub-navs that switch instantly, rules preview following the language tab, animated tooltips, rolling indicators, page/chart/menu motion and the brand mark.

**Architecture:** Two new shared primitives in `packages/ui` (Radix `Tooltip`, and `Tabs` with a Motion `layoutId` indicator) and two in `apps/admin/src/components` (`SubNav`, `RollingIndicator`). Sub-navs move into layouts (`content/layout.tsx`, `catalog/(sections)/layout.tsx`) so they stay mounted across navigation. Page entry is CSS keyframes in `(shell)/template.tsx`; chart motion is Motion/CSS inside the existing chart components.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, `motion` (^13, as in web), `@radix-ui/react-tooltip`, Jest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-polish-design.md`

Plans B (rich text), C (reporting currency) and D (Polish UI) follow as separate documents.

## Global Constraints

- Dark admin, one accent; `DESIGN.md` rules hold (one accent card per screen, status = dot + label, no chart library, `ring-accent` focus, no horizontal scroll at 390 px).
- No `prefers-reduced-motion` opt-out: animations always run (owner's decision). Remove the existing rule in `globals.css`; do not set `MotionConfig reducedMotion`.
- Categories stay a shared entity; no data-model change in this plan.
- Server plate click = select; pencil (tooltip "Edit server") opens `/catalog/servers/{id}`; pencil sits left of the drag handle in the top-right corner.
- Every other plate/row with a detail target is clickable as a whole; inner buttons (menu, copy, drag, pencil) keep their own action.
- Use impeccable (`/impeccable`) for motion timings/easing; ease-out curves, no bounce.
- Gate per commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; run `graphify update .` after code edits; Conventional Commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Clicking a row's menu button, copy button or drag handle must not also navigate — the row click handler must ignore clicks from inside `a, button, [role=menuitem], input, textarea`.
2. Selecting text in a clickable row (drag-select an email) must not navigate — ignore the click when `window.getSelection()?.toString()` is non-empty.
3. Ctrl/⌘-click and middle-click on a row should open in a new tab like a link — the row handler ignores modified clicks and the primary cell keeps a real `<Link>`.
4. Rapid clicks Rules → Texts → Settings must leave the pill on the last clicked tab, and browser Back must move the pill to the real path.
5. Tabs used uncontrolled (`defaultValue`) and controlled (`value`) must both move the indicator.

---

### Task 1: Rules preview follows the editor's language tab

**Files:**

- Modify: `apps/admin/src/features/content/components/rules-preview.tsx`
- Modify: `apps/admin/src/features/content/components/rules-editor.tsx:258`
- Test: `apps/admin/src/features/content/components/rules-preview.test.tsx`, `rules-editor.test.tsx` (if present; else add the case to `rules-preview.test.tsx`)

**Interfaces:**

- Produces: `RulesPreview({content, locale}: {content: RulesDocument; locale: 'en' | 'pl'})`

- [ ] **Step 1: Write failing tests** — `renders the Polish text when locale is pl` (render `<RulesPreview content={doc} locale="pl"/>`, expect PL title text); `has no language toggle of its own` (`queryByRole('group', {name: 'Preview language'})` is null). In the editor test: switching the main tab to PL shows the PL text inside `region {name: 'Preview'}`, then back to EN shows EN again.
- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- rules-preview` — FAIL.
- [ ] **Step 3: Implement** — drop the `useState` and the toggle group; take `locale` prop; editor passes `locale={tab}`.
- [ ] **Step 4: Run** the same — PASS.
- [ ] **Step 5: Commit** `fix(admin): rules preview follows the language tab`

### Task 2: Animated Tooltip primitive

**Files:**

- Create: `packages/ui/src/tooltip.tsx` (shadcn Tooltip on `@radix-ui/react-tooltip`), add export `./tooltip` to `packages/ui/package.json`, add the dependency.
- Modify: `apps/admin/src/app/providers.tsx` (wrap in `TooltipProvider delayDuration={300} skipDelayDuration={400}`)
- Modify: `apps/admin/src/app/globals.css` (keyframes `tooltip-in`/`tooltip-out`: fade + 4px slide from the side given by `data-side`, 150 ms in / 100 ms out, ease-out)
- Modify: `apps/admin/src/app/(shell)/_components/nav.tsx` (rail: replace `title` with Tooltip, `side="right"`), `features/content/components/texts-table.tsx` ("needs update" badge), `features/content/components/rules-preview.tsx` (EN fallback badge), `features/catalog/components/drag-handle.tsx` (Hint "Drag to reorder"), `features/orders/components/order-details.tsx` (copy-email button: Hint "Copy email")
- Test: `apps/admin/src/components/layout-components.test.tsx` (or a new `tooltip.test.tsx` in admin)

**Interfaces:**

- Produces: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` from `@shop/ui/tooltip`; plus admin helper `Hint({label, side?, children}: {label: string; side?: 'top'|'right'|'bottom'|'left'; children: ReactElement})` in `apps/admin/src/components/hint.tsx` (Tooltip + asChild trigger). Later tasks use `Hint`.

- [ ] **Step 1: Failing test** — `Hint shows its label on keyboard focus`: render `<TooltipProvider><Hint label="Orders"><button>x</button></Hint></TooltipProvider>`, `await user.tab()`, `expect(await screen.findByRole('tooltip')).toHaveTextContent('Orders')`. Nav test: rail links have no `title` attribute.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** primitive, `Hint`, provider, replacements. Content uses `bg-card-raised text-fg text-[12px] rounded-full px-2.5 py-1 shadow` and the keyframes via `data-[state=delayed-open]:animate-[tooltip-in_150ms_ease-out]`.
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(ui): animated tooltip; replace native titles in admin`

### Task 3: Rolling indicator for Tabs and the rail

**Files:**

- Modify: `packages/ui/src/tabs.tsx`, `packages/ui/package.json` (add `motion` ^13.4.6)
- Create: `apps/admin/src/components/rolling-indicator.tsx`
- Modify: `apps/admin/package.json` (add `motion`), `apps/admin/src/app/(shell)/_components/nav.tsx`
- Test: `packages/ui` has no Jest — test through admin: `apps/admin/src/components/rolling-indicator.test.tsx`

**Interfaces:**

- Produces: `RollingIndicator({className}: {className?: string})` — a `motion.span` with `layoutId` from the nearest `LayoutGroup`, `absolute inset-0 -z-10`, transition `{type: 'spring', bounce: 0, duration: 0.35}`. Callers render it inside the active item only, inside `<LayoutGroup id={useId()}>`.
- `Tabs` keeps its API. Internally it tracks the active value (controlled `value` or internal state seeded from `defaultValue`, updated in `onValueChange`), provides it by context and wraps children in a `LayoutGroup`; `TabsTrigger` becomes `relative isolate` and renders the indicator (`rounded-full bg-card-raised`) when its `value` is active. Remove `data-[state=active]:bg-card-raised` from the trigger class.

- [ ] **Step 1: Failing tests** — `Tabs renders one indicator, inside the active trigger` for controlled and for `defaultValue` usage (`container.querySelectorAll('[data-slot=tabs-indicator]')` length 1, and it is inside the trigger with `aria-selected=true`; click another trigger → it moves). Rail: `the current rail link contains the indicator`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Rail current link: drop `bg-fg text-bg` background class, keep `text-bg`, render `<RollingIndicator className="rounded-full bg-fg"/>`; links get `relative isolate`.
- [ ] **Step 4: Run** admin + web tests (web does not import `@shop/ui/tabs` today; typecheck all) — PASS.
- [ ] **Step 5: Commit** `feat(ui): rolling indicator for tabs and the admin rail`

### Task 4: Sub-navs for Content and Catalog that switch instantly

**Files:**

- Create: `apps/admin/src/components/sub-nav.tsx`, `sub-nav.test.tsx`
- Delete: `apps/admin/src/features/content/components/content-tabs.tsx` (+ test if any)
- Create: `apps/admin/src/app/(shell)/content/layout.tsx`, `content/loading.tsx`
- Modify: `content/{rules,texts,settings}/page.tsx` (drop `PageHeader` and `ContentTabs`; layout renders `PageHeader title="Content" description="Rules, interface texts and brand settings shown on the site."` then `SubNav`)
- Move: `apps/admin/src/app/(shell)/catalog/page.tsx` → `catalog/(sections)/page.tsx`; `catalog/categories/` → `catalog/(sections)/categories/`
- Create: `catalog/(sections)/layout.tsx` (`PageHeader title="Catalog"` with the existing description + `SubNav label="Catalog"` items Products `/catalog`, Categories `/catalog/categories`), `catalog/(sections)/loading.tsx`
- Remove: the "Manage categories" header button and the categories page's own header / "Back to catalog".

**Interfaces:**

- Produces: `SubNav({label, items}: {label: string; items: {href: string; label: string}[]})` — client; `nav aria-label={label}`; active = `pending ?? longest item.href that matches pathname` (exact for `/catalog`, prefix for others); `onClick` sets `pending=href` (skip modified clicks); pending is cleared when `usePathname()` changes using the "previous value in state" pattern (no effect); active link gets `aria-current="page"` and `RollingIndicator`. Layouts are server components that call `requireMe()` + permission check as the pages do now.
- `loading.tsx` renders `<SkeletonRows rows={6}/>`.

- [ ] **Step 1: Failing tests** (mock `next/navigation` `usePathname`) — `marks the clicked item current before the path changes`; `follows the path when it changes (Back)` (rerender with new pathname after a click on another item → current follows pathname); `ignores ctrl-click`; `/catalog/categories marks Categories, not Products`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** component, layouts, moves, loading files.
- [ ] **Step 4: Run** admin tests; `pnpm --filter @shop/admin build` succeeds (route group move) — PASS.
- [ ] **Step 5: Commit** `feat(admin): content and catalog sub-navs that switch instantly`

### Task 5: Whole-row clicks in DataTable

**Files:**

- Modify: `apps/admin/src/components/data-table.tsx`, `data-table.test.tsx`
- Modify: `apps/admin/src/features/orders/components/orders-table.tsx` (primary cell becomes plain `publicId` text in mono; pass `rowHref`)
- Modify: `apps/admin/src/features/catalog/components/categories-table.tsx` (`initialEdit?: string` prop seeds `editing`; pass `rowHref={c => '/catalog/categories?edit=' + c.id}` only when `canEdit`), `catalog/(sections)/categories/page.tsx` (read `searchParams.edit`, render `key={edit}`)

**Interfaces:**

- Produces: `DataTable` prop `rowHref?: (r: T) => string`. With it: the primary cell is wrapped in `<Link href>` (keyboard, ⌘-click, middle-click); `<tr>` and mobile `<li>` get `cursor-pointer` and an `onClick` that calls `router.push(href)` unless the event is modified (`metaKey|ctrlKey|shiftKey|altKey|button!==0`), comes from inside `a, button, input, textarea, [role=menuitem]`, or text is selected.
- `CategoriesTable({canEdit, initialEdit}: {canEdit: boolean; initialEdit?: string})`.

- [ ] **Step 1: Failing tests** — `clicking a cell navigates to rowHref` (mock `useRouter().push`, click the Date cell text within the table → `push('/orders/o1')`); `clicking the row menu does not navigate`; `does not navigate while text is selected` (stub `getSelection` → `'abc'`); `ctrl-click does not push`; `the primary cell is a link to rowHref`. Categories: `initialEdit opens the edit form for that category`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): whole rows open their detail page`

### Task 6: Catalog board — plates, pencils, empty state

**Files:**

- Modify: `apps/admin/src/features/catalog/components/product-card.tsx` (stretched link: `Link` gets `after:absolute after:inset-0 after:rounded-card after:content-['']`; `DragHandle` gets `z-10`)
- Modify: `server-card.tsx` (new prop `editHref?: string`; pencil `Link` icon button `aria-label="Edit {name}"` wrapped in `Hint label="Edit server"`, `absolute top-3 right-11`, coloured `onAccent`; `pr-20` when both icons; selected state = `RollingIndicator` ring `-inset-1 rounded-[24px] ring-2 ring-fg` inside a `LayoutGroup` owned by the board, replacing `aria-selected:ring-*`)
- Modify: `catalog-board.tsx` (pass `editHref` when `canEdit`; remove "Server settings" link; category header gets pencil `Link` `aria-label="Edit {category}"` → `/catalog/categories?edit={id}` with `Hint label="Edit category"`; zero categories → `EmptyState icon={Tags} title="No categories on {server} yet."` whose `action` holds the attach form and a `Link` "Create category" → `/catalog/categories`; the attach form below the list stays for servers that already have categories)
- Modify: `apps/admin/src/components/empty-state.tsx` only if `action` needs layout tweaks.
- Test: `catalog-board.test.tsx`, add `server-card` and `product-card` cases there or in new test files.

**Interfaces:**

- Consumes: `Hint` (Task 2), `RollingIndicator` (Task 3).
- Produces: `ServerCard` prop `editHref?: string`.

- [ ] **Step 1: Failing tests** — `clicking the server plate selects it and does not navigate`; `the pencil links to /catalog/servers/{id}` (`getByRole('link', {name: 'Edit Survival'})`); `no pencil without catalog.write`; `category pencil links to /catalog/categories?edit={id}`; `a server with no categories shows the attach form and a Create category link inside the empty state`; product card: the name link covers the card (assert class contains `after:inset-0`) and the drag handle is still its own button.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): edit pencils and whole-card links on the catalog board`

### Task 7: Server colour swatch and Commands help

**Files:**

- Modify: `apps/admin/src/features/catalog/components/server-editor.tsx:120-127` — swatch classes: `size-9 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0`.
- Create: `apps/admin/src/features/catalog/components/command-help.tsx`
- Modify: `product-editor.tsx` (grant/revoke textareas: merge `register` ref with a local ref; track the last focused of the two, default grant; render `CommandHelp` once under the Commands section; `COMMAND_HINT` shortened to "One command per line, without /.")
- Test: `product-editor.test.tsx`

**Interfaces:**

- Produces: `CommandHelp({onInsert}: {onInsert: (token: string) => void})` — lists one row: button `{nick}` (mono, accent-soft chip) + "The buyer's nickname", and an example line `give {nick} diamond 1`.
- Insert: `setValue(field, before + '{nick}' + after, {shouldDirty: true})` at `selectionStart/End`, then restore focus and caret after the token.

- [ ] **Step 1: Failing tests** — `clicking {nick} inserts it at the caret of the grant field` (type `say hi `, set caret at end, click `{nick}` → value `say hi {nick}`); `inserts into revoke when revoke was focused last`; `shows the example command`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. Check the swatch visually in Chrome and Firefox at `/catalog/servers/new`.
- [ ] **Step 5: Commit** `feat(admin): filled colour swatch and a {nick} helper for commands`

### Task 8: Brand mark in the rail

**Files:**

- Create: `apps/admin/src/app/(shell)/_components/brand-mark.tsx` (server component)
- Modify: `apps/admin/src/app/(shell)/layout.tsx` (replace the "S" span)
- Test: `apps/admin/src/app/(shell)/_components/brand-mark.test.tsx` (pure helper test)

**Interfaces:**

- Produces: `brandInitial(name: {plain: string; accent: string}): string` (first letter of `plain + accent`, upper-cased; `'?'` if empty) and `BrandMark()` — fetches `${API_ORIGIN}/api/content/settings` (`next: {revalidate: 60}`, 3 s timeout), falls back to `DEFAULT_SITE_SETTINGS` from `@shop/shared` on any failure; renders `Link href="/"` `aria-label={fullName}` wrapped in `Hint label={fullName} side="right"` with the existing accent circle. Move `API_ORIGIN` into `apps/admin/src/lib/api-origin.ts` and import it from `session.ts` too.

- [ ] **Step 1: Failing test** — `brandInitial({plain: 'Block', accent: 'haus'}) === 'B'`, `brandInitial({plain: '', accent: ''}) === '?'`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): brand mark from site settings`

### Task 9: Motion — page entry, charts, KPIs, menus

**Files:**

- Modify: `apps/admin/src/app/globals.css` — delete the `prefers-reduced-motion` block; add keyframes `enter` (opacity 0→1, translateY 8px→0, 320 ms, `cubic-bezier(0.22,1,0.36,1)`), `.page-enter > * > *` with `animation: enter … both` and `animation-delay: calc(var(--i, 0) * 40ms)` via `:nth-child(1..8)` setting `--i`; keyframes `menu-in` for Radix menus (fade + scale 0.97→1, origin from `--radix-dropdown-menu-content-transform-origin`).
- Create: `apps/admin/src/app/(shell)/template.tsx` — `<div className="page-enter">{children}</div>`.
- Modify: `apps/admin/src/components/day-chart.tsx` — bars grow from the bottom: `style={{transformOrigin: 'bottom', transformBox: 'fill-box', animation: 'bar-grow 500ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: i*12 ms}}`; keyframes `bar-grow` scaleY 0→1. Key the svg by the data range so switching 7d/30d replays.
- Modify: `apps/admin/src/components/status-donut.tsx` — segments sweep in: animate `stroke-dasharray` from `0 C` to final with `motion.circle` (600 ms, staggered by segment start).
- Modify: `apps/admin/src/components/spark.tsx` — line draws: `pathLength={1}`, `strokeDasharray 1`, keyframe dashoffset 1→0, 600 ms.
- Create: `apps/admin/src/hooks/use-count-up.ts`; Modify: `apps/admin/src/components/kpi-card.tsx` (optional `count?: {to: number; format: (n: number) => string}`; when given, shows `format(animated)`; `value` remains for non-numeric) and dashboard callers.
- Modify: `apps/admin/src/components/row-menu.tsx` (content gets `data-[state=open]:animate-[menu-in_140ms_ease-out]`).
- Modify: `DESIGN.md` — add a "Motion" section (page entry, rolling indicator, charts, tooltips, no reduced-motion opt-out by owner's decision) and the tooltip rule (no native `title`).
- Test: `apps/admin/src/hooks/use-count-up.test.ts`, `kpi-card` case in `data-components.test.tsx`

**Interfaces:**

- Produces: `useCountUp(to: number, durationMs = 700): number` — uses `motion`'s `animate(from, to, {duration, ease: [0.22,1,0.36,1], onUpdate})`, starts from 0 on mount and from the previous value on change; cleans up on unmount.

- [ ] **Step 1: Failing tests** — `useCountUp ends at the target` (fake timers / `await waitFor` → result `1234`); `KpiCard with count ends showing the formatted target` (`findByText('€12.34')`).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (use `/impeccable` for the final timing pass; keep durations ≤ 700 ms).
- [ ] **Step 4: Run** admin tests — PASS. Open `/`, `/orders`, `/catalog`, `/content/rules` in the browser and screenshot mid-animation and settled at 1440 and 390 px; no horizontal scroll at 390.
- [ ] **Step 5: Commit** `feat(admin): page, chart and menu motion`

### Task 10: E2E and the full gate

**Files:**

- Modify: `e2e/tests/admin.spec.ts` (and any spec touching catalog/content headings)

- [ ] **Step 1: Update/add e2e** — content: the rules preview shows PL text after switching the main tab to PL; `nav {name: 'Content'}` → click Texts → link `Texts` has `aria-current=page`; catalog: `nav {name: 'Catalog'}` link Categories opens the categories table; the server pencil opens the server editor; clicking an order row's Date cell opens the order page.
- [ ] **Step 2: Run** the full gate `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int`, then fresh e2e stack: `docker compose -p shop-e2e -f compose.yaml -f compose.e2e.yaml up -d --build --wait`, run e2e, `docker compose -p shop-e2e -f compose.yaml -f compose.e2e.yaml down -v`. Expected: all green.
- [ ] **Step 3: Commit** `test(e2e): admin sub-navs, pencils and row clicks`; `graphify update .`.
