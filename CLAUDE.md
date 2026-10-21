# CLAUDE.md

Rules for AI agents working in this repository.

## Source of truth

- Design: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`
- Plans: `docs/superpowers/plans/` — implement task by task, tick checkboxes.
- Decisions: `docs/adr/` — do not contradict an ADR; propose a new one instead.

## Architecture rules

- Business logic lives only in `apps/api` (NestJS). Next.js apps have no route handlers.
- NestJS global prefix is `/api`. Ports: web 3000, admin 3001, api 4000.
- Shared code goes in `packages/*` and is imported as `@shop/<name>`.
- Money is `amountMinor: Int` + `currency`. Never floats.
- Do not bump ESLint (9) or TypeScript (6) majors; see `docs/adr/0002-monorepo-tooling.md`.
- Catalog data comes from `GET /api/catalog` (contract in `@shop/shared`); web reads it with `getCatalog` on the server, never from `config/`. The layout gives `CatalogProvider` servers only; catalog pages pass products to `<Catalog>` as a prop. The cart lives in the `cart` cookie and is resolved on the server (`loadCart`). Locale routes render at request time (ADR 0007).
- Frontend layout (web, admin): `app/` + `_components`, `features/<name>/`, `components/`, `hooks/`, `lib/`; tweakable constants in `config/` (lowest layer, ADR 0005); imports flow shared → features → app; no barrels; see `docs/adr/0004-frontend-structure.md`.
- Admin auth: Better Auth in `apps/api` (ADR 0009). Admin endpoints use `@AdminController(path)` (session + TOTP + permissions + audit) and `@RequirePermission(...)` with permissions from `@shop/shared/access`; public endpoints are marked `@AllowAnonymous()`. Admin data access is RTK Query generated from `apps/api/openapi.json` (`pnpm --filter @shop/admin codegen`).
- Admin i18n (EN/PL): next-intl without locale routing; strings live in `apps/admin/messages/{en,pl}.json` (identical key sets, tested), the language is the `admin_locale` cookie written by the rail switch, server components use `getTranslations`, client ones `useTranslations`. API errors are translated by code (`apiErrors.*`), schema messages by key (`@shop/shared/validation-messages` + `apps/admin/src/lib/validation-messages.ts` → `validation.*`). Admin-entered data, Content → Texts keys and audit entries stay untranslated.
- Catalog writes go through `/api/admin/catalog` (the `catalog-admin` module: REST per entity, `version` for optimistic locking, full id lists for reorders). Every admin route must be documented in `apps/api/src/openapi/` with `operationId`, `tags`, `summary`, `description` and response descriptions; `admin-routes.spec.ts` fails otherwise. The admin's drag-and-drop lists use `SortableList` (`apps/admin/src/features/catalog/components/sortable-list.tsx`, dnd-kit).

- Site content (rules, UI text overrides, brand settings) lives in the database and is edited in admin under `/content` with `content.write` (ADR 0008); API: public `/api/content/*`, admin `/api/admin/content/*`. Web reads it through `fetch` with tags `content-rules`/`content-messages`/`content-settings` and `revalidate` from `CONTENT_REVALIDATE_SECONDS` (default 60, e2e 1); built-in files and `DEFAULT_SITE_SETTINGS` are the fallbacks. The api creates missing content rows at every start (`dist/seed/content-main.js` in the Dockerfile `CMD`); never re-run the full seed. Only keys in `EDITABLE_MESSAGES` (`@shop/messages`) can be overridden.
- Anything that expands from a button into a panel (menus, cart, pickers) uses `MorphPopover` (`apps/web/src/components/morph-popover.tsx`): trigger and panel share one Motion `layoutId` (container transform). Do not hand-roll `useState` + absolute dropdowns. Domain content goes in `features/<name>/components/` and is passed as `children`; see `settings-menu.tsx` and `cart-menu.tsx`. Plan: `docs/superpowers/plans/2026-10-02-morph-popover.md`.
- Centered blocking dialogs use `Modal` (`apps/web/src/components/modal.tsx`): controlled `open`/`onClose`, animated, stackable (a `Modal` inside another `Modal`'s children is a child layer; Escape and backdrop close only the top one). Do not hand-roll `<dialog>`. The product modal opens from client state, with no URL change and no Next intercepting route. Plan: `docs/superpowers/plans/2026-10-02-modal-stack.md`.
- Admin UI (dark, one sage accent) is built from `apps/admin/src/components/` (`Card`, `PageHeader`, `KpiCard`, `DataTable` + `RowMenu`, `FormSection`, `StatusDot`/`ToneDot`, `EmptyState`, `Skeleton`) and the tokens in `apps/admin/src/app/globals.css`; rules (one accent card per screen, status = dot + label, no chart library, `ring-accent` focus, no horizontal scroll at 390 px) are in `DESIGN.md`.
- Orders and payments: `orders` module (`POST /api/orders`, `GET /api/orders/:publicId`, `POST /api/webhooks/stripe`, admin `/api/admin/orders` with `order.read`). Payment providers sit behind `PaymentsGateway` (`apps/api/src/payments/`); the e2e uses `FakeGateway` (`PAYMENTS_GATEWAY=fake`, refused in production without `PAYMENTS_ALLOW_FAKE`). Webhook handling: dedupe by event id, conditional status update, side effects after commit (ADR 0010). Prices are always recomputed from the database.
- Promo codes live in `orders/promo` (`POST /api/promo/validate`, admin `/api/admin/promo-codes` with `promo.write`); the use is reserved as the last statement of the order transaction, released on expiry (and re-taken on a late payment); soft delete via `deletedAt`.

## Workflow

- TDD: failing test first, then code.
- Before a commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (plus `pnpm test:int` where Docker is available). Integration tests that query Postgres are `*.int-spec.ts`; plain `pnpm test` stays DB-free.
- Conventional Commits (`feat(api): …`, `fix(web): …`, `chore: …`).
- Never commit secrets; use `.env.example` for new variables.
- When unsure about a library's current API, or whether a solution with a library is a good one, use Context7 (`resolve-library-id` → `query-docs`) instead of guessing.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
