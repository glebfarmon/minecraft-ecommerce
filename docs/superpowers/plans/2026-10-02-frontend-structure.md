# Frontend Source Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `apps/web/src` into `app/` + `_components`, `features/`, `components/`, `hooks/`, `lib/`, with lint-enforced layer boundaries shared by `web` and `admin`, without changing behavior.

**Architecture:** Pure move refactor. Files move with `git mv` (history kept) and imports are rewritten with `sed`. ESLint `no-restricted-imports` in the shared Next config enforces `shared → features → app/store`. An ADR records the decision. Proof of no behavior change: the existing unit and e2e suites plus one new e2e test for the product modal route.

**Tech Stack:** Next.js 16 (App Router, private folders), TypeScript 6, ESLint 9 flat config, Jest 30 + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-frontend-structure-design.md`

## Global Constraints

- No new dependencies. Use ESLint's built-in `no-restricted-imports`.
- Do not bump ESLint (9) or TypeScript (6) majors.
- No `index.ts` barrel files. Import directly: `@/features/cart/components/add-to-cart`.
- File names are kebab-case; tests sit next to the file as `*.test.ts(x)`.
- Do not create `store/`, `packages/shared` or `packages/api-client`.
- Move with `git mv`, never delete + create.
- Move order is top-down (app sections → catalog → cart), not the spec §10 order: every intermediate commit must pass the boundary rule, and moving `cart` first would leave shared `components/navbar.tsx` importing `features/`.
- macOS `sed` needs `-i ''`.
- Pre-commit gate, from the repo root: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- After code changes: `graphify update .` (repo root).
- Conventional Commits; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Product modal interception (`app/[locale]/@modal/(.)[server]/[product]`) still opens a `<dialog>` on in-app navigation, and a direct load still renders the full page. Pinned by the new e2e test in Task 1.
2. `hero.tsx` imports `public/hero-steve.webp` by relative path; after the move the path is two levels deeper. `pnpm typecheck` fails on a wrong path (Task 3, Step 3).
3. The boundary rule must not block npm packages whose path contains `app` or `store` (`next/app`, `motion/react`), and must allow `@/store/hooks` in features. Pinned by the probe files in Task 1.
4. `nav-links.test.tsx` mocks `@/i18n/navigation` by alias; the mock must keep working after the file moves (Task 3 runs it).
5. Stale imports of old paths anywhere in `apps/web`. Each move task ends with a `grep` that must print nothing.

---

### Task 1: Boundaries — ADR, lint rule, admin alias, modal e2e baseline

**Files:**

- Create: `docs/adr/0004-frontend-structure.md`
- Modify: `CLAUDE.md` (section "Architecture rules")
- Modify: `packages/config/eslint/next.mjs`
- Modify: `apps/admin/tsconfig.json`, `apps/admin/jest.config.mjs`, `apps/admin/src/app/page.test.tsx:3`
- Test: `e2e/tests/product-modal.spec.ts` (new)

**Interfaces:**

- Produces: lint rule that later tasks must satisfy; `@/*` alias in `admin`.

- [ ] **Step 1: Write the probe files (the failing test for the lint rule)**

From `apps/web`:

```bash
mkdir -p src/hooks src/features/probe
cat > src/hooks/probe.ts <<'EOF'
export * from '@/features/cart/shop-provider'
export * from '../features/cart/shop-provider'
export * from '@/app/[locale]/_components/navbar'
export * from '@/store/store'
export * from 'next/app'
export * from 'motion/react'
EOF
cat > src/features/probe/probe.ts <<'EOF'
export * from '@/store/hooks'
export * from '@/store/store'
export * from '@/app/[locale]/_components/navbar'
export * from '@/hooks/use-scrolled'
EOF
```

- [ ] **Step 2: Run ESLint on the probes, confirm no `no-restricted-imports` errors yet**

Run (from `apps/web`): `pnpm exec eslint src/hooks/probe.ts src/features/probe/probe.ts 2>&1 | grep no-restricted-imports`
Expected: no output (rule not configured yet).

- [ ] **Step 3: Add the rule to `packages/config/eslint/next.mjs`**

Replace the file with:

```js
import nextVitals from 'eslint-config-next/core-web-vitals'
import {defineConfig} from 'eslint/config'

import {base} from './base.mjs'

// Layer direction: shared (components, hooks, lib, i18n) -> features -> app + store.
// See docs/adr/0004-frontend-structure.md.
export const next = defineConfig(
  base,
  nextVitals,
  {
    files: ['src/components/**', 'src/hooks/**', 'src/lib/**', 'src/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/app/**', '**/store/**'],
              message: 'Shared code must not import features, app or store (ADR 0004).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/features/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/store/**', '!**/store/hooks'],
              message: 'Features must not import app or store, except store/hooks (ADR 0004).'
            }
          ]
        }
      ]
    }
  }
)
```

Prettier will reformat it in Step 9; content is what matters.

- [ ] **Step 4: Re-run ESLint on the probes**

Run (from `apps/web`): `pnpm exec eslint src/hooks/probe.ts src/features/probe/probe.ts 2>&1 | grep no-restricted-imports`
Expected: exactly 6 lines — `hooks/probe.ts` lines 1–4 and `features/probe/probe.ts` lines 2–3. No error for `next/app`, `motion/react`, `@/store/hooks`, `@/hooks/use-scrolled`.

- [ ] **Step 5: Delete the probes**

```bash
rm -rf src/hooks src/features
```

- [ ] **Step 6: Add the `@/*` alias to `admin`**

`apps/admin/tsconfig.json` — add `paths` next to `types`:

```json
{
  "extends": "@shop/config/tsconfig/next.json",
  "compilerOptions": {
    "types": ["node", "jest", "@testing-library/jest-dom"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "next.config.ts", "src", ".next/types/**/*.ts", "jest.setup.ts"],
  "exclude": ["node_modules"]
}
```

`apps/admin/jest.config.mjs`:

```js
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({dir: './'})

export default createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Mirrors the `@/*` path in tsconfig.json; next/jest does not read it.
  moduleNameMapper: {'^@/(.*)$': '<rootDir>/src/$1'}
})
```

`apps/admin/src/app/page.test.tsx:3` — prove the alias in Jest and tsc:

```tsx
import AdminHomePage from '@/app/page'
```

- [ ] **Step 7: Run admin tests and typecheck**

Run (repo root): `pnpm --filter @shop/admin test && pnpm --filter @shop/admin typecheck`
Expected: PASS.

- [ ] **Step 8: Write the modal e2e test (characterization, must pass on the current code)**

`e2e/tests/product-modal.spec.ts`:

```ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test('product opens as a modal from the catalog and as a page on direct load', async ({page}) => {
  await page.goto(`${WEB}/survival`)
  await page.getByRole('link', {name: 'VIP', exact: true}).click()

  await expect(page).toHaveURL(/\/survival\/vip$/)
  await expect(page.getByRole('dialog', {name: 'VIP'})).toBeVisible()

  await page.goto(`${WEB}/survival/vip`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('link', {name: 'Back to shop'})).toBeVisible()
})
```

Run (repo root):

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e
```

Expected: all tests PASS, including the new one. If the `VIP` link is ambiguous, scope it: `page.locator('#shop').getByRole('link', {name: 'VIP', exact: true})`.

- [ ] **Step 9: Write ADR 0004**

`docs/adr/0004-frontend-structure.md`:

```markdown
# ADR 0004: Feature-based frontend structure

- Status: Accepted
- Date: 2026-10-02

## Context

`apps/web/src/components` was one flat folder mixing layout, page sections, shop domain code and primitives. Redux Toolkit, RTK Query and react-hook-form are coming, and `admin` will grow the same way.

## Decision

Both Next.js apps use the same layout: `app/` (routes, with `_components` for code used only under one segment), `features/<name>/` (domain code), `components/` and `hooks/` (domain-free), `lib/`, `i18n/`, and `store/` once Redux arrives. Imports flow `shared → features → app + store`, enforced by `no-restricted-imports` in `@shop/config/eslint/next`. No barrel files. Tests sit next to the code; e2e stays in `e2e/`.

Rejected: Feature-Sliced Design (too many layers for ~10 pages, layer names clash with Next routing) and per-page folders under `components/` (break when two pages share a component).

## Consequences

- Placement rule: one segment → `_components`; domain or cross-segment → `features/`; domain-free → `components/`/`hooks/` or `packages/ui`.
- Feature-to-feature imports are allowed without cycles; cycles are checked in review, not by lint.
- Details: `docs/superpowers/specs/2026-10-02-frontend-structure-design.md`.
```

`CLAUDE.md`, append to "Architecture rules":

```markdown
- Frontend layout (web, admin): `app/` + `_components`, `features/<name>/`, `components/`, `hooks/`, `lib/`; imports flow shared → features → app; no barrels; see `docs/adr/0004-frontend-structure.md`.
```

- [ ] **Step 10: Gate and commit**

```bash
pnpm exec prettier --write docs/adr/0004-frontend-structure.md CLAUDE.md packages/config/eslint/next.mjs apps/admin e2e/tests/product-modal.spec.ts && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add docs/adr/0004-frontend-structure.md CLAUDE.md packages/config/eslint/next.mjs apps/admin e2e/tests/product-modal.spec.ts
git commit -m "chore: enforce frontend layer boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

---

### Task 2: Move hooks and fairness, delete dead `fair-cases`

**Files:**

- Move: `apps/web/src/lib/use-scrolled.ts`, `use-scrolled.test.ts`, `use-dismiss.ts` → `apps/web/src/hooks/`
- Move: `apps/web/src/lib/fairness.ts`, `fairness.test.ts` → `apps/web/src/features/fairness/`
- Delete: `apps/web/src/components/fair-cases.tsx` (imported nowhere; its only import of `@/lib/fairness` goes with it)
- Modify: `apps/web/src/components/navbar.tsx` (hook imports)

**Interfaces:**

- Produces: `@/hooks/use-scrolled`, `@/hooks/use-dismiss`, `@/features/fairness/fairness` (same exports as before).

- [ ] **Step 1: Confirm `fair-cases` is unused**

Run (repo root): `grep -rn "fair-cases\|FairCases" apps/web/src e2e --include='*.ts*' | grep -v "components/fair-cases.tsx"`
Expected: no output.

- [ ] **Step 2: Move and delete**

```bash
cd apps/web/src
mkdir -p hooks features/fairness
git mv lib/use-scrolled.ts lib/use-scrolled.test.ts lib/use-dismiss.ts hooks/
git mv lib/fairness.ts lib/fairness.test.ts features/fairness/
git rm components/fair-cases.tsx
```

- [ ] **Step 3: Rewrite imports**

```bash
grep -rlE "@/lib/use-(scrolled|dismiss)'" . | xargs sed -i '' -E "s#@/lib/use-(scrolled|dismiss)'#@/hooks/use-\1'#g"
```

- [ ] **Step 4: Check no stale paths**

Run (from `apps/web/src`): `grep -rnE "@/lib/(use-|fairness)" .`
Expected: no output.

- [ ] **Step 5: Gate and commit**

```bash
cd ../../..
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add -A apps/web/src
git commit -m "refactor(web): move hooks and fairness out of lib

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

Expected: gate PASS, `use-scrolled.test.ts` and `fairness.test.ts` still run and pass.

---

### Task 3: Move layout and home sections into `app/[locale]/_components`

**Files:**

- Move: `apps/web/src/components/{navbar,nav-links,nav-links.test,footer,home-view,hero,faq,how-it-works,live-feed}.tsx` → `apps/web/src/app/[locale]/_components/`
- Modify (imports): `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`, `app/[locale]/[server]/page.tsx`, `app/[locale]/[server]/[product]/page.tsx`, moved files
- Modify: `app/[locale]/_components/hero.tsx:9` (image path)

**Interfaces:**

- Consumes: `@/hooks/use-scrolled`, `@/hooks/use-dismiss` (Task 2).
- Produces: `@/app/[locale]/_components/<name>` with the same exports as before.

- [ ] **Step 1: Move**

```bash
cd apps/web/src
mkdir -p 'app/[locale]/_components'
git mv components/navbar.tsx components/nav-links.tsx components/nav-links.test.tsx \
  components/footer.tsx components/home-view.tsx components/hero.tsx components/faq.tsx \
  components/how-it-works.tsx components/live-feed.tsx 'app/[locale]/_components/'
```

- [ ] **Step 2: Rewrite imports**

```bash
grep -rlE "@/components/(navbar|nav-links|footer|home-view|hero|faq|how-it-works|live-feed)'" . \
  | xargs sed -i '' -E "s#@/components/(navbar|nav-links|footer|home-view|hero|faq|how-it-works|live-feed)'#@/app/[locale]/_components/\1'#g"
```

- [ ] **Step 3: Fix the hero image path**

`app/[locale]/_components/hero.tsx:9`, the file is now two levels deeper (`src/app/[locale]/_components` vs `src/components`):

```tsx
import steve from '../../../../public/hero-steve.webp'
```

- [ ] **Step 4: Check the final tree and stale paths**

Run (from `apps/web/src`):

```bash
ls components
grep -rnE "@/components/(navbar|nav-links|footer|home-view|hero|faq|how-it-works|live-feed)'" .
```

Expected: `components` lists `add-to-cart.tsx catalog.tsx copy-ip.tsx grid-guides.tsx online-dot.tsx product-*.tsx shop-provider.tsx` (cart and catalog move in Tasks 4–5); grep prints nothing.

- [ ] **Step 5: Gate**

```bash
cd ../../..
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

Expected: PASS, including `nav-links.test.tsx` from its new location.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "refactor(web): colocate layout and home sections under [locale]

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

---

### Task 4: Move catalog into `features/catalog`

**Files:**

- Move: `apps/web/src/components/{catalog,product-card,product-detail,product-modal,product-plate,product-icon}.tsx` → `apps/web/src/features/catalog/components/`
- Modify (imports): `app/[locale]/@modal/(.)[server]/[product]/page.tsx`, `app/[locale]/[server]/[product]/page.tsx`, `app/[locale]/_components/home-view.tsx`, and the moved files that import each other

**Interfaces:**

- Consumes: `@/components/add-to-cart`, `@/components/shop-provider` (still shared until Task 5; features may import shared).
- Produces: `@/features/catalog/components/<name>` with the same exports as before.

- [ ] **Step 1: Move**

```bash
cd apps/web/src
mkdir -p features/catalog/components
git mv components/catalog.tsx components/product-card.tsx components/product-detail.tsx \
  components/product-modal.tsx components/product-plate.tsx components/product-icon.tsx \
  features/catalog/components/
```

- [ ] **Step 2: Rewrite imports**

```bash
grep -rlE "@/components/(catalog|product-card|product-detail|product-modal|product-plate|product-icon)'" . \
  | xargs sed -i '' -E "s#@/components/(catalog|product-card|product-detail|product-modal|product-plate|product-icon)'#@/features/catalog/components/\1'#g"
```

- [ ] **Step 3: Check no stale paths**

Run (from `apps/web/src`): `grep -rnE "@/components/(catalog|product-)" .`
Expected: no output.

- [ ] **Step 4: Gate and commit**

```bash
cd ../../..
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add -A apps/web/src
git commit -m "refactor(web): move catalog into features/catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

---

### Task 5: Move cart into `features/cart`, final e2e

**Files:**

- Move: `apps/web/src/components/shop-provider.tsx` → `apps/web/src/features/cart/shop-provider.tsx`
- Move: `apps/web/src/components/add-to-cart.tsx` → `apps/web/src/features/cart/components/add-to-cart.tsx`
- Modify (imports): `app/[locale]/layout.tsx`, `app/[locale]/_components/navbar.tsx`, `features/catalog/components/product-card.tsx`, `features/catalog/components/product-detail.tsx`

**Interfaces:**

- Consumes: final locations from Tasks 3–4. Edge `catalog → cart` is allowed; `cart` must not import `features/catalog`.
- Produces: `@/features/cart/shop-provider` (`ShopProvider`, `useShop`), `@/features/cart/components/add-to-cart` (same exports as before).

- [ ] **Step 1: Move**

```bash
cd apps/web/src
mkdir -p features/cart/components
git mv components/shop-provider.tsx features/cart/shop-provider.tsx
git mv components/add-to-cart.tsx features/cart/components/add-to-cart.tsx
```

- [ ] **Step 2: Rewrite imports**

```bash
grep -rl "@/components/shop-provider'" . | xargs sed -i '' "s#@/components/shop-provider'#@/features/cart/shop-provider'#g"
grep -rl "@/components/add-to-cart'" . | xargs sed -i '' "s#@/components/add-to-cart'#@/features/cart/components/add-to-cart'#g"
```

- [ ] **Step 3: Check the final tree, stale paths and the reverse edge**

Run (from `apps/web/src`):

```bash
ls components
grep -rnE "@/components/(shop-provider|add-to-cart)'" .
grep -rn "features/catalog" features/cart
```

Expected: `components` lists exactly `copy-ip.tsx grid-guides.tsx online-dot.tsx`; both greps print nothing.

- [ ] **Step 4: Gate**

```bash
cd ../../..
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

- [ ] **Step 5: Full e2e**

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e
```

Expected: all PASS (smoke, navbar, product-modal).

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "refactor(web): move cart into features/cart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```
