# Frontend Source Structure — Design

- Date: 2026-10-02
- Scope: `apps/web/src`, `apps/admin/src`, shared ESLint config
- Status: Approved in brainstorming, pending spec review

## 1. Goal

`apps/web/src/components/` is a flat folder of 22 files that mixes layout, home-page sections, shop domain code and small primitives. `lib/` mixes demo data, domain logic and hooks. New pages, Redux Toolkit (slices, RTK Query) and react-hook-form forms will make this worse.

Success criteria:

- Every file has one obvious home, decided by a one-line rule.
- `web` and `admin` follow the same convention.
- Layer boundaries are enforced by lint, not memory.
- The move changes no behavior: unit and e2e suites stay green.

Out of scope: introducing Redux, RTK Query, react-hook-form, `packages/shared` or `packages/api-client`. This spec only fixes where they go when they arrive.

## 2. Approach

Feature-based folders (Bulletproof React style) plus Next.js private folders (`_components`) for route-local code.

Rejected:

- Feature-Sliced Design: six layers are heavy for ~10 pages, and its `app`/`pages` layer names clash with Next.js routing.
- Colocation only in `app/`: gives cross-page domain code (cart, product card) no home.
- Folders per page under `components/` (`components/home`): breaks as soon as a component is used by two pages, which `product-card` already is.

## 3. Layout

```
src/
  app/                  routes only: thin page/layout files
    [locale]/
      _components/      code used only by routes under this segment
  features/<name>/      domain code: catalog, cart, fairness, later checkout, cases
  components/           domain-free UI
  hooks/                domain-free hooks
  lib/                  utilities, config, data access
  i18n/                 next-intl setup
  store/                Redux store (created with Redux, not before)
```

Placement rule:

1. Used by routes under one segment only → `_components/` of the nearest common segment.
2. Domain code, or used across segments → `features/<name>/`.
3. Domain-free UI or hooks → `components/` / `hooks/` (or `packages/ui` when `admin` needs it too).

## 4. Dependency direction

```
shared (components/ hooks/ lib/ i18n/)  →  features/  →  app/ + store/
```

- Shared code never imports `features/`, `app/` or `store/`.
- Features never import `app/`. From `store/` they import only `store/hooks.ts` (typed `useAppDispatch`/`useAppSelector`; its `RootState` import is type-only).
- `store/store.ts` assembles slices from features, so `store/` belongs to the app layer.
- A feature may import another feature as long as no cycle forms. Current edge: `catalog → cart`. Not lint-enforced (`import/no-cycle` adds a dependency and is slow); checked in review.
- `lib/catalog.ts` stays in `lib/`: both `cart` and `catalog` import its types and demo data, and moving it into `features/catalog` would create a `cart ↔ catalog` cycle. It is replaced later by RTK Query and `packages/shared` types.

## 5. Feature internals

```
features/checkout/
  components/
    checkout-form.tsx
    checkout-form.test.tsx
  hooks/
    use-checkout.ts
  checkout-slice.ts
  checkout-slice.test.ts
  schemas.ts
```

- Folders and files appear only when needed; a one-component feature is just `components/`.
- No `index.ts` barrels. Import directly: `@/features/cart/components/add-to-cart`. Barrels pull `'use client'` modules into server components, slow dev builds and invite import cycles.
- File names are kebab-case. Tests sit next to the file as `*.test.ts(x)`.
- Server components by default; `'use client'` only on interactive leaf components.

Data and schemas:

| What                             | Where                             | Why                                                   |
| -------------------------------- | --------------------------------- | ----------------------------------------------------- |
| Generated RTK Query hooks        | `packages/api-client`             | Used by `web` and `admin`; generated from API OpenAPI |
| valibot request/response schemas | `packages/shared`                 | Already in the main design spec                       |
| Form-only schema                 | `features/<name>/schemas.ts`      | Extends a shared schema with UI-only fields           |
| Client state slice               | `features/<name>/<name>-slice.ts` | State belongs to its feature                          |

Features have no own `api.ts`; they import hooks from `@shop/api-client`. The store follows the RTK Next.js guide: `makeStore()` per request, created in a client provider via `useRef`.

## 6. File moves (`apps/web/src`)

| Current                                                                                                                          | New                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `components/navbar.tsx`, `nav-links.tsx` (+ test), `footer.tsx`                                                                  | `app/[locale]/_components/`                |
| `components/home-view.tsx`, `hero.tsx`, `faq.tsx`, `how-it-works.tsx`, `live-feed.tsx`                                           | `app/[locale]/_components/`                |
| `components/catalog.tsx`, `product-card.tsx`, `product-detail.tsx`, `product-modal.tsx`, `product-plate.tsx`, `product-icon.tsx` | `features/catalog/components/`             |
| `components/shop-provider.tsx`                                                                                                   | `features/cart/shop-provider.tsx`          |
| `components/add-to-cart.tsx`                                                                                                     | `features/cart/components/add-to-cart.tsx` |
| `lib/fairness.ts` (+ test)                                                                                                       | `features/fairness/fairness.ts` (+ test)   |
| `lib/use-scrolled.ts` (+ test), `lib/use-dismiss.ts`                                                                             | `hooks/`                                   |
| `components/online-dot.tsx`, `copy-ip.tsx`, `grid-guides.tsx`                                                                    | `components/` (unchanged)                  |
| `components/fair-cases.tsx`                                                                                                      | deleted (imported nowhere)                 |
| `lib/catalog.ts`, `i18n/*`, `proxy.ts`                                                                                           | unchanged                                  |

`navbar` goes to `_components`, not `components/`, because it imports the cart. `/` and `/[server]` both render `home-view` and sit under `[locale]`, so that is the nearest common segment. `fairness.ts` moves to `packages/shared` once the API needs it; the package is not created now.

## 7. `apps/admin`

Same layout. Nothing to move yet. Add the `@/*` path alias to `apps/admin/tsconfig.json` and the matching `moduleNameMapper` to its Jest config so imports look the same in both apps.

## 8. Lint enforcement

Add `no-restricted-imports` overrides to `packages/config/eslint/next.mjs` (applies to `web` and `admin`):

| Files                                                            | Forbidden imports                             |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `src/components/**`, `src/hooks/**`, `src/lib/**`, `src/i18n/**` | `@/features/*`, `@/app/*`, `@/store/*`        |
| `src/features/**`                                                | `@/app/*`, `@/store/*` except `@/store/hooks` |

## 9. Testing

- Unit and component tests: Jest, colocated `*.test.ts(x)`. Jest already discovers them anywhere under `src`; no config change.
- E2E: Playwright in root `e2e/tests/`, organized by user flow. Unaffected by the move.
- Proof of no behavior change: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` after every commit, e2e once at the end.

## 10. Rollout

One PR on `refactor/frontend-structure`, several commits, each green:

1. `docs/adr/0004-frontend-structure.md` and a one-line rule in `CLAUDE.md`.
2. ESLint boundary rule and the `admin` `@/*` alias.
3. `git mv` per group with import fixes: `hooks/` → `features/fairness` → `features/cart` → `features/catalog` → `app/[locale]/_components`.
4. Delete `fair-cases.tsx`.
5. Run e2e.
