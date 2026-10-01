# Floating Pill Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The storefront navbar sits flat and transparent at the top of the page and, once the user scrolls, shrinks into a narrower frosted "floating pill" with border, background, blur and shadow, animated over 300ms.

**Architecture:** A tiny `useScrolled()` hook reports whether `window.scrollY` is past a threshold. `Navbar` mirrors it into a `data-scrolled` attribute on `<nav>`, and Tailwind `data-scrolled:` variants switch `max-width`, border, background, blur and shadow. A CSS `transition` on exactly those properties does the animation; no Motion, no JS animation.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Jest + Testing Library (unit), Playwright (e2e).

**Spec:** `example-navigation.md` (reference behavior, plain HTML) + `docs/design-system.md` §6 Navbar and §8 Motion.

## Reference analysis (`example-navigation.md`)

The example toggles classes on one bar element; nothing else moves.

| Property                   | At top (`scrollY` ≈ 0)                                                  | Scrolled ("floating pill")                    |
| -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `max-width`                | `max-w-7xl` (80rem)                                                     | `max-w-6xl` (72rem): the bar "shrinks" inward |
| border                     | `border-neutral-200/0` (invisible, but present so layout does not jump) | `border-neutral-200/40`                       |
| background                 | none                                                                    | `bg-neutral-100/50` (translucent)             |
| blur                       | none                                                                    | `backdrop-blur-lg`                            |
| shadow                     | none                                                                    | layered soft shadow + 1px hairline ring       |
| height, top margin, radius | `h-14`, `mt-2`, `rounded-xl`                                            | unchanged                                     |
| animation                  | `transition-all duration-300 ease-in-out` on the bar                    |                                               |

Our mapping: keep our height (64px), top offset (16px), `rounded-full` and dark palette. Width goes `1440px → 1200px` (same −240px feel as the example's −128px, scaled to our wider layout). Transition lists explicit properties instead of `transition-all`, uses our `ease-out-expo` token and `--dur-base` (300ms).

## Global Constraints

- Do not add dependencies; Tailwind + React already cover this.
- Durations/curves from `docs/design-system.md` §8: base 300ms; `prefers-reduced-motion: reduce` → only a 200ms crossfade, no size change animation.
- Colors only from `@theme` tokens in `apps/web/src/app/globals.css` (`border`, `surface`, …). No new hex values.
- Pre-commit gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `apps/web/src/i18n/routing.ts` has an unrelated uncommitted change: never `git add` it in this plan. Stage files by path.
- After code changes run `graphify update .` from the repo root.

## Review Focus

1. **Reload mid-page.** User refreshes while scrolled down (or follows `/#faq`): the pill must appear immediately, not wait for the next scroll event. Pinned by the hook test "reads scroll position on mount" (Task 1) and e2e "pill is on after loading a deep anchor" (Task 2).
2. **Scrolling back to the top** must return the bar to the flat transparent state. Pinned by hook test "turns off when back at the top" (Task 1) and e2e "navbar turns into a floating pill on scroll" (Task 2).
3. **Threshold boundary / jitter at 0–8px** (iOS rubber-band, trackpad micro-scroll) must not flicker the pill. Pinned by hook test "stays off at exactly the threshold" (Task 1).
4. **Dropdowns inside the nav** (settings, cart) must still open and be readable in both states; `backdrop-filter` on `<nav>` already exists today, so absolute dropdowns are unaffected. Checked manually in Task 2 Step 6.
5. **Reduced motion:** width must snap, only colors fade. Checked manually in Task 2 Step 6 via DevTools "Emulate prefers-reduced-motion".

---

## File Structure

| File                                    | Action                           | Responsibility                                 |
| --------------------------------------- | -------------------------------- | ---------------------------------------------- |
| `apps/web/src/lib/use-scrolled.ts`      | Create                           | Hook: `true` when `window.scrollY > 8`         |
| `apps/web/src/lib/use-scrolled.test.ts` | Create                           | Unit tests for the hook (jsdom)                |
| `apps/web/src/components/navbar.tsx`    | Modify (`<nav>` at lines 39-41)  | Wire hook → `data-scrolled`, two-state classes |
| `e2e/tests/navbar.spec.ts`              | Create                           | Browser test of both states                    |
| `docs/design-system.md`                 | Modify (§6 Navbar, first bullet) | Document the two states                        |

---

### Task 1: `useScrolled` hook

**Files:**

- Create: `apps/web/src/lib/use-scrolled.ts`
- Test: `apps/web/src/lib/use-scrolled.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `export function useScrolled(): boolean` — `true` while `window.scrollY > 8`. Updates on `scroll` (passive listener) and once on mount.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/use-scrolled.test.ts`:

```ts
import {act, renderHook} from '@testing-library/react'

import {useScrolled} from './use-scrolled'

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', {value: y, configurable: true})
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('useScrolled', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', {value: 0, configurable: true})
  })

  it('is false at the top of the page', () => {
    const {result} = renderHook(() => useScrolled())
    expect(result.current).toBe(false)
  })

  it('reads scroll position on mount', () => {
    Object.defineProperty(window, 'scrollY', {value: 500, configurable: true})
    const {result} = renderHook(() => useScrolled())
    expect(result.current).toBe(true)
  })

  it('turns on after scrolling past the threshold', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(9)
    expect(result.current).toBe(true)
  })

  it('stays off at exactly the threshold', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(8)
    expect(result.current).toBe(false)
  })

  it('turns off when back at the top', () => {
    const {result} = renderHook(() => useScrolled())
    scrollTo(300)
    scrollTo(0)
    expect(result.current).toBe(false)
  })

  it('removes the scroll listener on unmount', () => {
    const remove = jest.spyOn(window, 'removeEventListener')
    const {unmount} = renderHook(() => useScrolled())
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    remove.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shop/web test -- use-scrolled`
Expected: FAIL with `Cannot find module './use-scrolled'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/use-scrolled.ts`:

```ts
'use client'

import {useEffect, useState} from 'react'

const THRESHOLD = 8

/** True once the window is scrolled more than a few pixels from the top. */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > THRESHOLD)
    }
    update()
    window.addEventListener('scroll', update, {passive: true})
    return () => {
      window.removeEventListener('scroll', update)
    }
  }, [])

  return scrolled
}
```

Notes for the implementer:

- Initial state is `false` so server HTML and first client render match (no hydration warning); `update()` in the effect fixes it right after mount.
- React skips re-render when `setScrolled` gets the same boolean, so no throttling is needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @shop/web test -- use-scrolled`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/use-scrolled.ts apps/web/src/lib/use-scrolled.test.ts
git commit -m "feat(web): add useScrolled hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Floating pill navbar

**Files:**

- Modify: `apps/web/src/components/navbar.tsx` (imports at top; `Navbar()` body; `<nav>` at lines 39-41)
- Modify: `docs/design-system.md` (§6 Navbar, first bullet, line 156)
- Test: `e2e/tests/navbar.spec.ts`

**Interfaces:**

- Consumes: `useScrolled(): boolean` from `@/lib/use-scrolled` (Task 1).
- Produces: `<nav aria-label="Main">` carries `data-scrolled=""` when scrolled and no attribute at the top. The e2e test relies on this.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/tests/navbar.spec.ts`:

```ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

// Wide enough that the 1440px → 1200px shrink is visible (gutter caps at 64px).
test.use({viewport: {width: 1600, height: 900}})

test('navbar turns into a floating pill on scroll', async ({page}) => {
  await page.goto(`${WEB}/en`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  const width = async () => (await nav.boundingBox())?.width ?? 0
  const bg = () => nav.evaluate(el => getComputedStyle(el).backgroundColor)

  await expect(nav).not.toHaveAttribute('data-scrolled')
  expect(await bg()).toBe(TRANSPARENT)
  expect(await width()).toBe(1440)

  await page.mouse.wheel(0, 600)
  await expect(nav).toHaveAttribute('data-scrolled')
  await expect.poll(width).toBe(1200)
  await expect.poll(bg).not.toBe(TRANSPARENT)

  await page.evaluate(() => {
    window.scrollTo({top: 0, behavior: 'instant'})
  })
  await expect(nav).not.toHaveAttribute('data-scrolled')
  await expect.poll(width).toBe(1440)
})

test('pill is on after loading a deep anchor', async ({page}) => {
  await page.goto(`${WEB}/en#faq`)
  await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-scrolled')
})
```

- [ ] **Step 2: Run it to verify it fails**

Start the local stack the same way as for `smoke.spec.ts` (Traefik + `pnpm dev`), then:

Run: `pnpm --filter @shop/e2e test:e2e -- navbar`
Expected: FAIL. First test fails on `expect(await bg()).toBe(TRANSPARENT)` (today the nav always has `bg-surface/80`); second fails waiting for `data-scrolled`.

- [ ] **Step 3: Implement the two states in `navbar.tsx`**

Add the import (Prettier sort-imports will place it; keep `@/lib/*` group):

```ts
import {useScrolled} from '@/lib/use-scrolled'
```

In `Navbar()`, next to `const [menuOpen, setMenuOpen] = useState(false)`:

```ts
const scrolled = useScrolled()
```

Replace the opening `<nav>` tag (currently lines 39-41):

```tsx
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 rounded-full border border-border bg-surface/80 pr-2 pl-6 backdrop-blur-md">
```

with:

```tsx
      <nav
        aria-label="Main"
        data-scrolled={scrolled || undefined}
        className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 rounded-full border border-transparent pr-2 pl-6 transition-[max-width,background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out-expo motion-reduce:transition-[background-color,border-color,box-shadow] motion-reduce:duration-200 data-scrolled:max-w-[1200px] data-scrolled:border-border data-scrolled:bg-surface/70 data-scrolled:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] data-scrolled:backdrop-blur-md">
```

Why each piece:

- `border border-transparent` at top: border always occupies 1px, so content does not jump 1px when it becomes visible (same trick as `border-neutral-200/0` in the example).
- `data-scrolled={scrolled || undefined}`: React omits the attribute when `undefined`, so the Tailwind v4 `data-scrolled:` variant (matches attribute presence) applies only when scrolled.
- Explicit `transition-[…]` list instead of `transition-all`: avoids animating `gap`, `padding`, etc. on breakpoint changes.
- `ease-out-expo` is the existing `--ease-out-expo` token from `globals.css`; `duration-300` is `--dur-base`.
- `motion-reduce:` drops `max-width`/`backdrop-filter` from the transition (size snaps) and shortens to 200ms, per design-system §8.

- [ ] **Step 4: Run e2e to verify it passes**

Run: `pnpm --filter @shop/e2e test:e2e -- navbar`
Expected: PASS, 2 tests. Then run the whole suite to make sure smoke still passes:
Run: `pnpm --filter @shop/e2e test:e2e`
Expected: PASS, 6 tests.

- [ ] **Step 5: Update the design system**

In `docs/design-system.md` §6 Navbar, replace the first bullet:

```md
- Плавающая пилюля `--color-surface`, рамка `--color-border`, отступ сверху 16px, высота 64px, `backdrop-filter: blur(12px)` поверх фона.
```

with:

```md
- Два состояния, высота 64px и отступ сверху 16px в обоих. **Вверху страницы** — плоская, прозрачная, без рамки и blur, ширина до 1440px. **После скролла > 8px** — «floating pill»: сужается до 1200px, фон `--color-surface` 70%, рамка `--color-border`, `backdrop-filter: blur(12px)`, мягкая тень. Переход 300ms `--ease-out-expo` по `max-width`, фону, рамке, тени, blur; при `prefers-reduced-motion` — только цвета, 200ms.
```

- [ ] **Step 6: Manual check in the browser**

Run `pnpm dev`, open `http://localhost:3000/en` at ≥1600px wide:

1. Top: bar is flat, guides of the hero visible behind it.
2. Scroll: bar narrows and frosts in one smooth 300ms motion.
3. Open the language/currency dropdown and the cart in both states: both open below the bar, readable.
4. DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce": width snaps, colors fade.
5. Open a server page (`/en/<server>`) at the top: links stay readable over its content.

- [ ] **Step 7: Gate, graph update, commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
graphify update .
git add apps/web/src/components/navbar.tsx e2e/tests/navbar.spec.ts docs/design-system.md
git commit -m "feat(web): shrink navbar into floating pill on scroll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
