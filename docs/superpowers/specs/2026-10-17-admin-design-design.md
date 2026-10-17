# Admin visual design and order stats

- Date: 2026-10-17
- Status: Draft
- Parent: `2026-10-01-minecraft-donation-shop-design.md` (admin §, roadmap row 3). Inserted before sub-project 5 so that the deliveries log (5a) and the dashboard's delivery health (5c) are built on this system.
- References (owner screenshots, kept out of git): `admin-2` (overall look: card modules, rail sidebar, KPI cards), `admin-1` (order list: status by colour, row menu), `admin-3` (catalog as visual preview cards).

## 1. Goal and success criteria

Staff open the admin and immediately see how the shop is doing and what needs attention; a problem order is spotted by colour in one glance; it is obvious from the screen what can be configured.

- One visual system (tokens + shared components) used by every admin screen; no screen keeps its own ad-hoc spacing, buttons or tables.
- Home is a dashboard with order statistics.
- Desktop first; at 390 px wide every screen works without horizontal page scroll: orders, order details, row actions, catalog browsing, team, content, audit. Editors stay usable on a phone (single column), but are tuned for desktop.
- WCAG 2.2 AA: contrast, focus rings, keyboard access to row menus, status never conveyed by colour alone.
- Behaviour, API contracts (except the new stats endpoint), permissions and storefront are unchanged; existing admin unit tests and e2e pass after selector updates only where markup changed.
- Gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:int` and e2e green.

## 2. Decisions

| #   | Topic           | Decision                                                                                                                                                                                                                                                                                                                           |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual world    | The storefront's world, tuned for work: dark base, Inter Tight, JetBrains Mono for ids and hashes, one accent. Dense, small type (13–14 px body), no decoration. Owner pick (2026-10-17).                                                                                                                                          |
| 2   | Composition     | From `admin-2`: rounded card modules on a dark ground, a narrow icon rail inside a pill, KPI cards with small charts, exactly one accent-filled card per screen at most. The reference's light palette is translated to dark.                                                                                                      |
| 3   | Accent          | Admin accent is a fixed sage green (the `admin-2` hue, lightened for dark ground). Catalog cards additionally use each server's own `accent`/`onAccent` from the database. Status colours are separate tokens and never reuse the accent.                                                                                          |
| 4   | Order list      | From `admin-1`: each row is a raised "plate"; status = coloured dot + label (green paid/delivered, amber pending, grey expired, red refunded/disputed); a `⋯` menu per row with the row's actions (4a: Open, Copy public link, Copy email; 5a adds delivery actions). On phones rows become stacked cards.                         |
| 5   | Catalog         | From `admin-3`: servers, categories and products are preview cards. Server card filled with its accent, name, product count, RCON state. Product card: large product icon on an accent-tinted plate, mark, name, EUR/PLN prices, kind, active state. A "+ Add" card closes each grid. Drag-and-drop ordering keeps `SortableList`. |
| 6   | Imagery         | No uploads in this pass: card visuals come from data already in the database (server accent, product `icon` rendered with the same lucide icons as the storefront, `mark`). No 3D/decorative art from `admin-3`.                                                                                                                   |
| 7   | Dashboard       | New home: KPI row (revenue EUR, revenue PLN, paid orders, conversion), revenue chart by day, status breakdown, top products, latest orders. Range switch 7 / 30 days. Delivery health is added by 5c.                                                                                                                              |
| 8   | Stats API       | `GET /api/admin/stats/orders?range=7d\|30d`, permission `order.read`, documented in `apps/api/src/openapi/`. One aggregate query set in Postgres; days are UTC.                                                                                                                                                                    |
| 9   | Charts          | Small hand-written SVG components (sparkline, area/bar by day, ring); no chart library. They render from props, have a text alternative (`aria-label` with the totals) and respect `prefers-reduced-motion`.                                                                                                                       |
| 10  | Where code goes | Tokens and fonts in `apps/admin/src/app/globals.css` + `layout.tsx`; admin-only shared components in `apps/admin/src/components/` (ADR 0004); `packages/ui` primitives (button, input, select, table, tabs, checkbox, textarea) are restyled through tokens, not forked.                                                           |
| 11  | Light theme     | Not in this pass (owner chose the dark world).                                                                                                                                                                                                                                                                                     |
| 12  | Not here        | Deliveries log and delivery actions (5a), delivery health KPIs (5c), image uploads, promo screens (4b).                                                                                                                                                                                                                            |

## 3. Visual system

### Tokens (`apps/admin/src/app/globals.css`)

Values follow the storefront (`apps/web/src/app/globals.css`) so both apps read as one product.

| Token                                                          | Role                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--color-bg`                                                   | page ground (`#0e0e10`)                                                                                            |
| `--color-surface`                                              | rail, top bar, inputs (`#17171a`)                                                                                  |
| `--color-card`                                                 | card modules, table plates (`#1d1d20`)                                                                             |
| `--color-card-raised`                                          | hovered / menu / popover (`#26262a`)                                                                               |
| `--color-line` / `--color-border`                              | hairlines 7 % / borders 12 % white                                                                                 |
| `--color-fg` / `--color-muted`                                 | text / secondary text                                                                                              |
| `--color-accent` / `--color-on-accent` / `--color-accent-soft` | admin sage green, text on it, 16 % tint                                                                            |
| `--color-ok` / `--color-warn` / `--color-bad` / `--color-idle` | statuses: green, amber, red, grey; each with a `-soft` tint                                                        |
| radii                                                          | card 20 px, plate 14 px, control/pill full                                                                         |
| type                                                           | 12 (labels, uppercase tracked) / 13 (table) / 14 (body) / 20 (section) / 28 (page title) / 32 (KPI value, tabular) |

Fonts through `next/font/google`: Inter Tight (400/500/700), JetBrains Mono (500).

### Shared components (`apps/admin/src/components/`)

| Component                   | Purpose                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `Card`                      | module container; `tone="accent"` for the one filled card; optional header with title + action     |
| `PageHeader`                | title, one-line description, primary action slot                                                   |
| `KpiCard`                   | label, value, delta vs previous period, optional sparkline                                         |
| `StatusDot`                 | dot + label for order (and later delivery) statuses; maps status → token                           |
| `DataTable`                 | plate rows, sticky header, sortable column hint, row link, row `RowMenu`, stacked cards below `md` |
| `RowMenu`                   | `⋯` button opening an accessible menu (Radix dropdown via shadcn), keyboard operable               |
| `PreviewCard` / `AddCard`   | catalog visual cards                                                                               |
| `EmptyState`                | icon, one sentence, optional action                                                                |
| `Skeleton`                  | loading placeholders matching card / row shapes                                                    |
| `FormSection`               | titled group of fields in a card, two columns on desktop, one on mobile                            |
| `Spark`, `DayChart`, `Ring` | SVG charts (decision 9)                                                                            |

### Shell

- Desktop: left rail 72 px wide inside a pill (icons with tooltip labels, active item filled), avatar + sign-out at the bottom; top bar with page title area, global search (order publicId / nick / email → `/orders?q=`) and the signed-in user.
- Below `md`: rail hidden; top bar with a menu button opening the nav as a sheet; content single column.
- Nav entries and their permissions stay as in `config/nav.ts`; each entry gains an icon.

## 4. Screens

| Route                                                              | After this pass                                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                | Dashboard (decision 7). Without `order.read`: greeting + quick links only.                                                   |
| `/orders`                                                          | `DataTable` with status filter tabs (All / Paid / Pending / Expired / Problem), search, cursor "Load more"; row menu.        |
| `/orders/[id]`                                                     | Summary card (status, total, nick, email, dates), items card grouped by server, timeline card (created, paid, expired).      |
| `/catalog`                                                         | Server preview cards grid → selecting a server shows its categories and product cards; existing drag-and-drop ordering kept. |
| `/catalog/servers/*`, `/catalog/products/*`, `/catalog/categories` | Editors rebuilt from `FormSection`s with a live preview card beside the form on desktop.                                     |
| `/team`, `/audit`, `/account`, `/content/*`                        | Same function, restyled with `PageHeader`, `Card`, `DataTable`, `FormSection`, empty states.                                 |
| `(auth)` login / 2FA / invite                                      | Centered card on the dark ground, same tokens.                                                                               |

## 5. Stats API

`GET /api/admin/stats/orders?range=7d|30d` (default `7d`), `@RequirePermission('order.read')`.

```ts
type OrderStats = {
  range: '7d' | '30d'
  from: string // ISO, start of the first UTC day
  to: string // ISO, now
  revenue: {currency: 'EUR' | 'PLN'; totalMinor: number; previousMinor: number}[]
  paidCount: number
  previousPaidCount: number
  expiredCount: number
  conversion: number | null // paid / (paid + expired) over the range; null when both are 0
  byStatus: {status: OrderStatus; count: number}[]
  daily: {day: string; currency: 'EUR' | 'PLN'; totalMinor: number; paidCount: number}[] // every day present, zeros filled
  topProducts: {productId: string; name: string; serverName: string; quantity: number}[] // top 5 by quantity
}
```

- Revenue counts orders with `paidAt` in the range and status `PAID` or `DELIVERED` (refunded/disputed excluded); "previous" is the same-length range before it.
- Contract (`OrderStatsSchema`) lives in `@shop/shared/orders`; admin hook generated by codegen (`useGetOrderStatsQuery`).
- Range is validated (`7d` | `30d`, anything else 400).

## 6. Testing

- API int-spec: empty database (zeros, `conversion: null`, all days present); mixed statuses and currencies; boundary at UTC midnight; previous-period numbers; `order.read` required (403 without it).
- Admin unit tests: `StatusDot` mapping for every status; `DataTable` stacked layout and row menu keyboard; `KpiCard` delta sign; charts' `aria-label`; dashboard renders from a stats fixture and the empty state.
- e2e: dashboard visible after login with order numbers; `/orders` row menu opens with keyboard; mobile project (390 px) renders orders and nav sheet without horizontal scroll; existing admin specs keep passing.
- Visual check: desktop 1440 and mobile 390 screenshots of dashboard, orders, catalog and an editor, reviewed once against this spec.
