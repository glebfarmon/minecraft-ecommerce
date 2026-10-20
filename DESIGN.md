# Design system

How the shipped apps look, recorded from the built code. One section per app. The storefront (`apps/web`) has no section yet.

## Admin (apps/admin)

The storefront's dark world put to work: card modules on a dark ground. Colour tells you status before you read the text. It deliberately avoids the usual white sidebar with grey bordered tables. The surface brief is in `apps/admin/.impeccable/surfaces/apps-admin.md`. Tokens live in `apps/admin/src/app/globals.css` (`@theme`, Tailwind 4).

### Tokens

| Token                | Value                     | Use                                                                                |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `bg`                 | `#0e0e10`                 | Page ground                                                                        |
| `surface`            | `#17171a`                 | Rail pill, mobile sheet, tab list, input fields                                    |
| `card`               | `#1d1d20`                 | Cards, table plates, form sections                                                 |
| `card-raised`        | `#26262a`                 | Hover on plates and ghost buttons, menus, skeletons, chips, empty chart bars       |
| `line`               | `rgb(255 255 255 / 0.07)` | Hairlines (shared `TableRow` bottom border)                                        |
| `border`             | `rgb(255 255 255 / 0.12)` | Input and outline-button borders, dashed empty/add cards                           |
| `fg`                 | `#f2f2f2`                 | Text; also the fill of the current nav item (`bg-fg text-bg`)                      |
| `muted`              | `#8e8e93`                 | Secondary text, labels, inactive nav                                               |
| `accent`             | `#9cc5a1` (sage)          | Primary button, the single accent card, focus ring, chart bars, sparks, brand mark |
| `on-accent`          | `#0e1a10`                 | Text on accent fills                                                               |
| `accent-soft`        | accent 16%                | `::selection`                                                                      |
| `ok` / `ok-soft`     | `#3ddc84` / 14%           | Paid, delivered, positive delta                                                    |
| `warn` / `warn-soft` | `#ffc857` / 14%           | Pending, incomplete                                                                |
| `bad` / `bad-soft`   | `#ff8a80` / 14%           | Refunded, disputed, errors, danger actions, negative delta                         |
| `idle` / `idle-soft` | `#8e8e93` / white 6%      | Expired, disabled                                                                  |
| `radius-card`        | `20px`                    | Cards, form sections, empty states, catalog cards                                  |
| `radius-plate`       | `14px`                    | Table plates, inputs, menus, inner blocks, alerts, skeletons                       |
| full                 | `rounded-full`            | Buttons, tabs, pills, nav items, rail, avatars                                     |

- `html { color-scheme: dark; accent-color: accent }`: the admin is dark only, so native selects, date pickers, checkboxes and scrollbars follow the dark ground. Caret colour is the accent.
- Legacy aliases (`primary`, `background`, `foreground`, `input`, `muted-foreground`, `destructive`) map to the tokens above for older code. New code uses the real names.
- `prefers-reduced-motion: reduce` cuts every animation and transition to 0.01ms.

### Type

| Role                 | Spec                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family               | Inter Tight (`--font-sans`, weights 400/500/600/700 loaded), JetBrains Mono (`--font-mono`, 500)                                                               |
| Body                 | 14px (`body`); dense content (table cells, menus, descriptions, small buttons) 13px                                                                            |
| Page title           | `PageHeader` h1: 28px semibold, tracking -0.01em, wraps anywhere                                                                                               |
| Auth title           | 22px semibold                                                                                                                                                  |
| Card / section title | 15px semibold                                                                                                                                                  |
| KPI value            | 32px semibold, leading-none, tracking -0.02em, `.tabular`                                                                                                      |
| Label                | `.label-caps`: 11px semibold, tracking 0.12em, uppercase, muted. Used for table headers, KPI labels and the sheet title                                        |
| Meta / pills         | 12px (status pills, deltas); 11px (chart axis, catalog pills, mono marks)                                                                                      |
| Mono                 | JetBrains Mono for things you copy or type exactly: order ids, slugs, product marks, audit action keys, message keys, RCON grant/revoke commands, backup codes |
| Numbers              | `.tabular` (tabular-nums) on money, counts and axes                                                                                                            |

`.label-caps` sits in `@layer components` so a utility can override it, e.g. `text-on-accent/70` on the accent KPI card. Keep it there.

### Layout

- **Shell** (`app/(shell)/layout.tsx`): `p-4` grid, `md:grid-cols-[auto_1fr]`, gap 16px.
- **Rail** (md and up): a sticky 72px-wide `rounded-full bg-surface` pill, full height minus 2rem. Top to bottom: the accent "S" brand mark (40px circle), icon nav (44px circles, label in `aria-label`/`title`), and the account initial at the bottom. The current item is `bg-fg text-bg`, not the accent. Nav items come from `config/nav.ts` and are filtered by permission. Content matches `/content/*`.
- **Top bar**: 56px tall. It holds the mobile menu button (below md), global search (needs `order.read`), and "email · role" on the right from sm up.
- **Content**: `main` is `mx-auto max-w-[1400px] pb-12`. Pages stack `PageHeader` and then cards with gap 16–24px.
- **Mobile sheet** (`mobile-nav.tsx`, below md): a Radix Dialog sliding in from the left, 288px wide, `bg-surface`, with a `bg-black/60` overlay. It uses the same `Nav` with labels and closes on navigate.
- **No horizontal page scroll at 390px.** Every grid and flex child that can shrink gets `min-w-0`. Long text uses `[overflow-wrap:anywhere]` or `truncate`. Tables either switch to a list (`DataTable`) or scroll inside their own box (`Table`).

### Components

| Component                         | Where                                           | Use when                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card`                            | `components/card.tsx`                           | Any module on a screen. Optional `title` (h2, labels the section) and `action`. `tone="accent"` is limited by the one-accent rule                                                                                                                                       |
| `KpiCard`                         | `components/kpi-card.tsx`                       | Headline numbers: label-caps, a 32px value, an optional `Spark`, and a delta coloured ok/bad (no colour on accent)                                                                                                                                                      |
| `PageHeader`                      | `components/page-header.tsx`                    | Top of every page: h1, an optional muted description, and actions on the right that wrap below                                                                                                                                                                          |
| `EmptyState`                      | `components/empty-state.tsx`                    | No rows: a dashed `border` card, an icon in a raised circle, muted text, an optional action                                                                                                                                                                             |
| `Skeleton`, `SkeletonRows`        | `components/skeleton.tsx`                       | Loading. Plate-radius pulse blocks; rows are 48px with a `role="status"` "Loading…"                                                                                                                                                                                     |
| `FormSection`                     | `components/form-section.tsx`                   | A group of form fields: a `fieldset` card with a legend title and description, fields in 2 columns from md, `disabled` locks the whole group                                                                                                                            |
| `StatusDot`, `ToneDot`            | `components/status-dot.tsx`                     | Any status. A 24px pill on a soft tint with a 6px dot and a text label. `StatusDot` maps `OrderStatus` through `STATUS_TONE`/`STATUS_LABEL`                                                                                                                             |
| `StatusDonut`                     | `components/status-donut.tsx`                   | Order share by status: SVG ring segments in status colours with small gaps, total in the centre, full breakdown in `aria-label`                                                                                                                                         |
| `Spark`                           | `components/spark.tsx`                          | An inline trend line in `currentColor` (accent, or on-accent on the accent card)                                                                                                                                                                                        |
| `RichTextField`                   | `components/rich-text/rich-text-field.tsx`      | Text with bold, italic and underline (and links where the rules allow them), stored as the mini-markdown of `@shop/shared/rules`. Selecting text shows a toolbar; ⌘B/⌘I/⌘U work. Rule texts and product descriptions use it; every other field keeps `Input`/`Textarea` |
| `DayChart`                        | `components/day-chart.tsx`                      | Value per day: SVG bars in the accent, zero days as `card-raised` stubs, a `<title>` per bar, first/last date caption                                                                                                                                                   |
| `DataTable`                       | `components/data-table.tsx`                     | Every list of records (orders, audit, team, categories)                                                                                                                                                                                                                 |
| `RowMenu`                         | `components/row-menu.tsx`                       | Per-row actions: a ghost icon button with a Radix dropdown (`card-raised`, plate radius); items with `tone: 'danger'` are `text-bad`                                                                                                                                    |
| `Button`                          | `packages/ui/src/button.tsx`                    | Pill buttons. `default` (accent fill) for the main action, `outline` for secondary, `ghost` for toolbar/back/icon, `danger` (`bad-soft` + `bad/40` border) for destructive confirms. Sizes: default 36px, `sm` 32px, `lg` 40px, `icon` 36px                             |
| `Tabs`                            | `packages/ui/src/tabs.tsx`                      | Switching between views: a `surface` pill track, 32px pill triggers, active trigger is `card-raised` + `fg`                                                                                                                                                             |
| `Input` (and `Textarea`/`Select`) | `packages/ui/src/`                              | 36px fields: `surface` fill, `border`, plate radius, `aria-invalid` turns the border `bad`                                                                                                                                                                              |
| `Table` family                    | `packages/ui/src/table.tsx`                     | Only for the listed exceptions (below). Hairline rows, label-caps heads, 13px cells, inside a `relative overflow-x-auto` box                                                                                                                                            |
| `ServerCard`                      | `features/catalog/components/server-card.tsx`   | Server tab on the catalog board, and its editor preview when there is no `onSelect`                                                                                                                                                                                     |
| `ProductCard`                     | `features/catalog/components/product-card.tsx`  | Product tile: a 16:10 icon well tinted with the server accent, name (a link when `href` is set), EUR · PLN prices, kind chip, `ToneDot`s for Disabled/Incomplete                                                                                                        |
| `AddCard`                         | `features/catalog/components/add-card.tsx`      | "Add …" slot at the end of a card grid: dashed `border`, muted, fills `card` on hover                                                                                                                                                                                   |
| `DragHandle`                      | `features/catalog/components/drag-handle.tsx`   | A 28px grip button for `SortableList`, named "Move {label}". On product cards it shows on hover/focus, always on touch                                                                                                                                                  |
| `EditorLayout`                    | `features/catalog/components/editor-layout.tsx` | Catalog editors: `PageHeader` with a ghost "Back to catalog", the form column, and a sticky preview `Card`                                                                                                                                                              |
| `AuthCard`                        | `features/auth/components/auth-card.tsx`        | Every sign-in step: accent "S" mark (48px) above a `max-w-sm` card, 12vh from the top                                                                                                                                                                                   |

### Rules

1. **At most one accent-filled card per screen.** On the dashboard it is the EUR revenue `KpiCard`. Everything else is `bg-card`. Accent fills are also used for the primary button, the brand mark, chart bars and the focus ring. Those are not cards.
2. **Status is always a dot plus a text label**, through `StatusDot`/`ToneDot`, never colour alone. Status colours (`ok`/`warn`/`bad`/`idle`) never reuse the accent, and the accent never stands for a status.
3. **Table rows are raised plates.** Use `DataTable`: a `border-separate border-spacing-y-1.5` table whose cells are `bg-card` with `rounded-l/r-plate` ends and `card-raised` on row hover, with label-caps headers and no grid lines. Below md it renders a `<ul>` of plates instead: the primary column bold on top, the other columns as muted-label/value lines. **Both are in the DOM**, so each cell's content appears twice. Tests and e2e must target the visible one (scope by role/viewport, not bare text).
4. **Row actions live in `RowMenu`.** `DataTable`'s `menu` prop adds the menu and names it "Actions for {primary}" (or `rowLabel`). A row with no actions gets no button. Destructive actions (remove, reset 2FA, change role) never run from the menu. They open a confirmation panel (`rounded-card bg-card p-4`) **above the table** that spells out the consequence, with a `danger` confirm and an `outline` cancel. Errors show above it as a `bad-soft` plate with `role="alert"`.
5. **Catalog preview cards use the server's own colours.** `ServerCard` fills with `server.accent` / `server.onAccent`, and `ProductCard` tints its icon well with `color-mix(server accent 22%)`. These are data colours the shop owner picked. They are not the admin accent and don't count toward rule 1. Pills on server cards use `currentColor` at 14% so they read on any accent.
6. **Live preview from xl up.** `EditorLayout` adds a sticky 20rem preview column at `xl`. Below xl the preview is hidden and the form takes the full width.
7. **Focus ring is `focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`**, plus `ring-offset-2 ring-offset-bg` on buttons and server cards. `ring-[--color-accent]` does **not** work in Tailwind 4, so always use the theme utility `ring-accent`. A selected server card shows a `ring-fg` ring that rolls between cards (`RollingIndicator`).
8. **Charts are hand-written SVG** (`Spark`, `DayChart`, `StatusDonut`) with `role="img"` and a full `aria-label`. Do not add a chart library.
9. **`.label-caps` stays in `@layer components`** so utilities can override its colour and size.
10. **The shared `Table` scroll box is `relative`.** An `sr-only` label (absolutely positioned) inside a cell would otherwise escape the `overflow-x-auto` box and widen the page at 390px.
11. **Whole plates are the click target.** A `DataTable` row with `rowHref` (or `onRowClick`) opens on a click anywhere except inner buttons, links and text selection; its primary cell stays a real link for keyboard and ⌘-click. Product cards use a stretched link. Server cards are the exception: a click selects the server, the pencil opens its editor.
12. **No native `title` tooltips.** Icon buttons and badges get `Hint` (`@shop/ui/tooltip`), which also needs a focusable trigger.
13. **Native `<select>` is not used.** `@shop/ui/select` is the designed Radix select (`combobox` + `option` roles; label it with `htmlFor` or `aria-label`).
14. Lucide icons only, `aria-hidden`, 16px in buttons and 20px in nav. Icon-only controls carry an `aria-label`.

### Motion

Motion always runs: there is **no `prefers-reduced-motion` opt-out** (the owner's decision). Easing is ease-out (`cubic-bezier(0.16,1,0.3,1)` or `(0.22,1,0.36,1)`), never bounce; exits are faster than entrances.

- **Rolling indicator.** One choice among several (rail, `Tabs`, `SubNav`, server cards, select highlight) shows a pill that slides to the chosen item with a shared Motion `layoutId` (spring, `bounce: 0`, 0.25–0.35 s). Use `RollingIndicator` inside a `LayoutGroup`; `@shop/ui/tabs` has its own.
- **Page entry.** `(shell)/template.tsx` wraps pages in `.page-enter`: the page root's blocks rise 8 px and fade in, 320 ms, 40 ms apart (capped at the eighth). Sub-navs live in layouts, so switching Rules/Texts/Settings or Products/Categories does not replay the header.
- **Charts.** `DayChart` bars grow from the baseline (500 ms, 12 ms stagger, replayed on a new range); `Spark` lines draw (600 ms); `StatusDonut` segments sweep in round the ring; `KpiCard` numbers count up (`count` prop, 700 ms) while the DOM text stays the settled value.
- **Selection toolbar.** The `RichTextField` toolbar rises 4 px and scales in from 0.96 (160 ms), its three buttons cascade 20 ms apart, and it fades out in 100 ms. Pure CSS (`.rich-toolbar*` in `globals.css`); active marks are accent-soft buttons.
- **Overlays.** Tooltips slide 4 px out of their side (150 ms in, 100 ms out). Row menus scale from their trigger (140 ms). The select list unfolds out of the field with a clip-path (220 ms), its options cascade (18 ms each, ≤126 ms), the check draws, and it closes in 120 ms.

### Known exceptions

- **`/content/texts`** (`features/content/components/texts-table.tsx`) stays a real `<Table>` with an override input inline in each row. The e2e depends on its row and cell structure. Below md the key column hides and the key shows in mono above the default text instead; Save and Reset sit under the input.
- **The rules editions list** (`features/content/components/versions-list.tsx`) stays a plain `<ul>` list, not a `DataTable`.
- `features/team/components/roles-matrix.tsx` also uses the shared `Table`: a permission grid is a matrix, not a record list.
