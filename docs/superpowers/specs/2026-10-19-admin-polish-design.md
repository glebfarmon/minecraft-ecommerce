# Admin polish: motion, reporting currency, rich text, Polish UI

Date: 2026-10-19. Follows `2026-10-17-admin-design-design.md` (PR #26). Rules for the look stay in `DESIGN.md`.

## Why

The owner used the redesigned admin and hit friction: clicks that do nothing visible, controls that are easy to miss, a preview that ignores the language switch, revenue split into two numbers that cannot be added, and an interface that feels static. This round fixes those and adds Polish UI, formatted text and a single reporting currency.

## Goals

1. Every big plate or row is clickable as a whole, not only its title.
2. The admin feels alive: page-entry motion, chart motion and a rolling indicator for every "one of several" choice.
3. Revenue is read in one currency at a time, using the exchange rate fixed at payment.
4. Admins can switch the whole admin UI between English and Polish.
5. Rule texts and product descriptions get bold / italic / underline through a selection toolbar.

## Non-goals

- Categories stay a separate, shared entity attached to servers (the owner considered per-server categories and decided against it).
- No colours, headings or other formatting beyond bold, italic, underline (plus links already allowed in rules).
- No new command placeholders: `{nick}` stays the only one.
- No live/today exchange rates anywhere in reporting.

## Anti-goals

- A click that changes nothing visible.
- Past revenue that changes from one day to the next.
- Formatting that the storefront cannot render.

## Parts

### 1. Whole-plate clicks

- Product cards, table rows (orders, admins, invites, categories, audit if it has a detail target) and any other plate whose title is the only link: the whole plate is the link target. Buttons inside (row menu, copy, drag handle, edit pencil) keep their own action and do not trigger navigation. Implementation is the owner-free builder's choice (stretched-link `::after` overlay on the primary link is the expected pattern; keyboard focus stays on one link per row).
- **Exception, servers on `/catalog`:** clicking a server plate still _selects_ it (shows its categories and products below). The selected server must be obviously selected (the rolling indicator from part 2 moves to it). A pencil icon button sits in the top-right corner, left of the drag handle, with tooltip "Edit server", linking to `/catalog/servers/{id}`. The "Server settings" link next to the heading may go.
- Each category header on `/catalog` gets the same pencil, linking to that category's edit view.

### 2. Motion

Use `motion` (already used by web; add to admin) and the impeccable skill for the motion design. No `prefers-reduced-motion` opt-out: the owner asked for animations to always run, so the existing global reduced-motion rule in `apps/admin/src/app/globals.css` is removed. (Owner's decision.)

- **Page entry:** content blocks enter with a short staggered fade/rise.
- **Charts:** revenue line draws left to right; donuts sweep in; KPI numbers count up.
- **Rolling indicator** (shared `layoutId`, like web's `nav-links.tsx`) for: left rail nav, every Tabs instance (`packages/ui/src/tabs.tsx` or an admin wrapper), Content sub-nav, the new Catalog sub-nav, server selection, the EN/PL language switch.
- **Menus and tooltips** animate open/close.

### 3. Tooltips

Add a shadcn Tooltip (Radix `@radix-ui/react-tooltip`) to `packages/ui`, with an animated entrance (short delay, small offset slide + fade; skip delay when moving between adjacent triggers via the provider). Replace native `title` on: rail icons, logo mark, language switch, icon-only buttons (pencil, copy, drag handle), the "needs update" text badge and the rules preview's EN fallback badge.

### 4. Content section

- **Rules preview follows the main language tab.** Remove the preview's own EN/PL toggle; `RulesPreview` takes `locale` from the editor's tab.
- **Fast switching between Rules / Texts / Settings:** the active pill in `nav aria-label="Content"` moves immediately on click (optimistic, not after the server responds), with the rolling indicator; the three routes are prefetched; a `loading.tsx` skeleton shows while a route loads; RTK Query caches keep returning visits instant.

### 5. Catalog section

- Sub-nav under the Catalog header, same component as the Content one: **Products** (`/catalog`) and **Categories** (`/catalog/categories`). Replaces the ghost "Manage categories" button.
- A server with no categories shows a prominent empty-state plate: attach-category select plus a "Create category" link — not the current grey sentence.
- Colour fields (`server-editor.tsx`): the swatch is a solid filled circle of the chosen colour, no inner square or frame; clicking it opens the native picker; the hex input stays.
- Commands field (`product-editor.tsx`): a help panel under it lists `{nick}` ("buyer's nickname") and an example command; clicking the variable inserts it at the caret.

### 6. Reporting currency (API + dashboard)

**Data.** On `Order`, add: `eurPlnRate` (decimal, PLN per 1 EUR, fixed), `totalEurMinor` and `totalPlnMinor` (Int, the total expressed in each currency, rounded half-up to minor units). Original `currency`/`totalMinor` stay. Values are written once and never recomputed.

**Rate source.** NBP (Narodowy Bank Polski) table A mid rate for EUR from the **last table published before the day of `paidAt`** (Europe/Warsaw), i.e. the previous business day — the rule Polish accounting uses. The rate is therefore known at payment time and does not depend on when it was fetched. Chosen because it is free, keyless, and the rate Polish accounting uses; Stripe only exposes a rate when presentment ≠ settlement currency. (Builder's call, approved by the owner.)

**When.** Set when an order becomes paid, after commit (ADR 0010: side effects after commit). If NBP is unreachable, payment handling is unaffected; the fields stay null and a retry job fills them later (any order with `paidAt` and null rate). The e2e / `FakeGateway` environment must not call NBP — use a fixed-rate provider behind the same interface.

**Backfill.** One-off migration/script fills existing paid orders using the NBP rate for their `paidAt` date.

**Stats API.** `GET /api/admin/stats` takes a `currency` (EUR | PLN) and returns, in that currency: revenue, paid orders, average order value, conversion, LTV, the daily revenue series, plus the share of paid orders by original currency (count and original-currency sum per currency). Orders with a null rate are excluded from converted sums and reported as a count so the UI can say "N orders waiting for an exchange rate". OpenAPI docs per the repo rule.

**LTV.** Average total spend per distinct buyer email over the range (owner's choice: identify buyers by email). Compare emails case-insensitively.

**Dashboard.**

- One currency selector (EUR / PLN, rolling indicator) above the chart controls the whole dashboard.
- KPIs: Revenue, Paid orders, Average order, Conversion (+ LTV — the builder may place it as a fifth KPI or under the chart; one accent card per screen still applies).
- One revenue chart.
- Below it, a donut of paid orders by original currency (e.g. 65 % EUR / 35 % PLN); hover/focus shows the original-currency sum.
- The separate "Revenue EUR" / "Revenue PLN" cards and the chart's own EUR/PLN tabs go away.
- Kept (my call): the "vs previous period" deltas (the previous period is converted the same way), the orders-by-status donut, top products and latest orders. Two donuts on one screen is acceptable; they differ in title and colours.
- Default currency: the builder's call (EUR suggested); remembered per browser.

### 7. Rich text (bold / italic / underline)

**Where:** rule section titles and items (EN, PL), and the product `description` field (EN, PL). Product `sections` (titles and entries) stay plain text (my call). Descriptions are multi-line: line breaks are kept and render as line breaks/paragraphs. Before switching web to the renderer, check existing descriptions in the database for stray `*`, `+` or `[..](..)`; if any exist, escape them in a migration so they keep rendering literally.

**Combining marks (my call):** marks may combine (bold + italic, underline inside a link, etc.), as Tiptap allows. `parseInline` becomes a nesting parser that returns a tree; `toPlainText`, link validation, web `RichText` and `RulesPreview` move to the tree. Not names, not Content → Texts overrides (they have their own placeholders/tags), not brand settings.

**Editor:** a selection ("bubble") toolbar that animates in above the selected text with **B**, _I_, U buttons, active state in the accent; ⌘B / ⌘I / ⌘U shortcuts; formatting shows inline in the field (WYSIWYG, not asterisks). Existing rule links must survive editing. Library is the builder's call; Tiptap with its BubbleMenu is the expected choice (check with Context7).

**Storage:** the existing rules mini-markdown in `packages/shared/src/rules.ts` (`**bold**`, `*italic*`, `[label](href)`), extended with one underline syntax (builder's call, e.g. `++text++`). Old texts stay valid; no data migration. `parseInline`, its validation, the web `RichText` (`apps/web/src/features/rules/components/rich-text.tsx`), the admin `RulesPreview`, and wherever web renders product descriptions must all handle underline. Product descriptions currently render as plain text on web and in the admin card preview: they switch to the same renderer. Copy-text/search helpers keep working on the plain words.

### 8. Polish admin UI

- EN / PL switch at the bottom of the left rail, above the avatar (rolling indicator, tooltip). Mobile sheet nav gets the same switch.
- The whole admin UI is translated: nav, headers, buttons, tables, forms, validation errors, empty states, sign-in, 2FA, invite pages.
- API errors are translated by their code; unknown codes fall back to the English message.
- Field validation messages (my call): the valibot schemas in `@shop/shared` keep their English messages, and each shared message gets a stable key (e.g. an exported `MESSAGES` map from key to English text, with the schema using the English text). The admin translates by key; the API and web keep working unchanged.
- Dates and money format per the chosen locale.
- Choice stored in a cookie (builder's call); no per-account setting.
- Library: next-intl, as on web (builder's call). Admin strings live in the admin app, not in `@shop/messages` (that package is the storefront's editable texts).
- Not translated: admin-entered data, Content → Texts keys, audit log entries.

### 9. Logo mark

The placeholder "S" in the rail becomes the first letter of the site name from Content → Settings (`siteName.plain` + `siteName.accent`), tooltip with the full site name, links to the dashboard.

## Constraints

- Repo rules in `CLAUDE.md` and ADRs apply (money as Int minor units — the rate is the only non-integer and lives as a Postgres decimal, never a JS float in sums; Prisma migration; OpenAPI documentation; TDD; e2e green).
- The admin is dark, one accent; `DESIGN.md` rules hold and are updated where this changes them (motion, tooltips, reduced motion, rich text).
- No horizontal scroll at 390 px.

## Left to the builder

Order of work, file layout, the underline syntax, the editor library, exact motion timings, LTV placement, default reporting currency, how the retry job is scheduled. Suggested order: 1/3/4/5/9 (UI fixes) → 2 (motion) → 7 (rich text) → 6 (currency) → 8 (Polish UI, last so it translates final strings).
