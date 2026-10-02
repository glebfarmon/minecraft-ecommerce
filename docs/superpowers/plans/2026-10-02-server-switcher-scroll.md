# Server Switcher Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the server pills (Survival, Anarchy, Minigames, …) do not fit the free width, the row scrolls horizontally with no visible scrollbar, and soft edge fades show which side still has hidden servers. The selected server is always scrolled into view.

**Architecture:** The row already is an `overflow-x-auto` flex container inside `catalog.tsx`; it only lacks `min-w-0` (so it can shrink), a hidden scrollbar and the hint. Add a domain-free `ScrollFade` component (`components/`) backed by a `useScrollEdges` hook (`hooks/`): the hook reports whether content is hidden at the start/end, the component writes that to `data-fade-start` / `data-fade-end`, and one CSS rule turns the data attributes into a `mask-image` gradient (fade only on the side that has more content). Fade width animates through a registered `@property`. `Catalog` swaps its raw `div` for `ScrollFade` and scrolls the active pill into view when the server changes (chevrons, click, deep link).

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Jest + Testing Library, CSS `mask-image` + `@property`.

**Spec:** `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md` (shop UI). No new ADR: stays inside `docs/adr/0004-frontend-structure.md` (shared code in `components/` + `hooks/`, no barrels).

## Global Constraints

- No new dependencies.
- Imports flow shared → features → app: `ScrollFade` and `useScrollEdges` import nothing from `features/` or `app/`.
- No barrel files; tests sit next to the code.
- Colors/tokens only from `@theme` in `globals.css`; the fade is a mask, so it needs no color and works on any background.
- Respect `prefers-reduced-motion`: no smooth scrolling and no fade-width transition.
- Do not add fake servers to `lib/catalog.ts`; verify with a narrow viewport instead.
- Pre-commit gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

## Review Focus

- Content fits exactly (or by < 1px rounding): no fade on either side, no flicker. Covered by Task 1 test.
- Content grows or shrinks after mount (font load, locale change, window resize) without a scroll event: edges must update. Covered by Task 1 `ResizeObserver` test.
- Active pill is off-screen after a chevron click or deep link to the last server: it must scroll into view. Covered by Task 3 test.
- Mouse without horizontal wheel and no scrollbar: the row must stay operable. The chevrons step the selection and the active pill scrolls into view, so every server stays reachable; verified in Task 3 manual check.
- Keyboard focus on a pill clipped by the fade: browser scrolls focused element into view; verified in Task 3 manual check.

## File Structure

- Create `apps/web/src/hooks/use-scroll-edges.ts`: `useScrollEdges(ref)` returns `{start, end}` booleans (more content hidden before / after).
- Create `apps/web/src/hooks/use-scroll-edges.test.ts`.
- Create `apps/web/src/components/scroll-fade.tsx`: horizontal scroller with hidden scrollbar and edge fades.
- Create `apps/web/src/components/scroll-fade.test.tsx`.
- Modify `apps/web/src/app/globals.css`: `.scroll-fade-x` rule and `@property`.
- Modify `apps/web/jest.setup.ts`: jsdom stubs for `ResizeObserver` and `scrollIntoView`.
- Modify `apps/web/src/features/catalog/components/catalog.tsx` and `catalog.test.tsx`.

---

### Task 1: `useScrollEdges` hook

**Files:**

- Create: `apps/web/src/hooks/use-scroll-edges.ts`
- Test: `apps/web/src/hooks/use-scroll-edges.test.ts`
- Modify: `apps/web/jest.setup.ts`

**Interfaces:**

- Produces: `useScrollEdges<T extends HTMLElement>(ref: RefObject<T | null>): {start: boolean; end: boolean}`. `start` = content hidden before the left edge, `end` = content hidden after the right edge.

- [ ] **Step 1: Add jsdom stubs** (jsdom has neither API). Append to `apps/web/jest.setup.ts`:

```ts
// jsdom has no layout engine: ResizeObserver never fires and scrollIntoView does not exist.
if (typeof window !== 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = jest.fn()
}
```

- [ ] **Step 2: Write the failing test** `use-scroll-edges.test.ts`

```ts
import {act, renderHook} from '@testing-library/react'

import {useScrollEdges} from './use-scroll-edges'

function makeScroller({scrollWidth, clientWidth, scrollLeft}: Record<string, number>) {
  const el = document.createElement('div')
  const set = (key: string, value: number) =>
    Object.defineProperty(el, key, {value, configurable: true, writable: true})
  set('scrollWidth', scrollWidth ?? 0)
  set('clientWidth', clientWidth ?? 0)
  set('scrollLeft', scrollLeft ?? 0)
  return {el, set}
}

describe('useScrollEdges', () => {
  it('reports hidden content only at the end when at the start', () => {
    const {el} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 0})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: true})
  })

  it('reports both sides in the middle and only the start at the end', () => {
    const {el, set} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 100})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: true, end: true})
    set('scrollLeft', 300)
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toEqual({start: true, end: false})
  })

  it('reports nothing when the content fits', () => {
    const {el} = makeScroller({scrollWidth: 200, clientWidth: 200, scrollLeft: 0})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: false})
  })

  it('ignores sub-pixel rounding', () => {
    const {el} = makeScroller({scrollWidth: 200, clientWidth: 199.5, scrollLeft: 0.4})
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(result.current).toEqual({start: false, end: false})
  })

  it('re-measures when the element or a child resizes', () => {
    let notify: () => void = () => undefined
    const observe = jest.fn()
    window.ResizeObserver = class {
      constructor(cb: () => void) {
        notify = cb
      }
      observe = observe
      unobserve() {}
      disconnect() {}
    }
    const {el, set} = makeScroller({scrollWidth: 200, clientWidth: 200, scrollLeft: 0})
    el.appendChild(document.createElement('button'))
    const {result} = renderHook(() => useScrollEdges({current: el}))
    expect(observe).toHaveBeenCalledTimes(2) // the element and its child
    set('scrollWidth', 500)
    act(() => {
      notify()
    })
    expect(result.current).toEqual({start: false, end: true})
  })

  it('removes the scroll listener on unmount', () => {
    const {el} = makeScroller({scrollWidth: 500, clientWidth: 200, scrollLeft: 0})
    const add = jest.spyOn(el, 'addEventListener')
    const remove = jest.spyOn(el, 'removeEventListener')
    const {unmount} = renderHook(() => useScrollEdges({current: el}))
    const handler = add.mock.calls.find(([type]) => type === 'scroll')?.[1]
    unmount()
    expect(handler).toBeDefined()
    expect(remove).toHaveBeenCalledWith('scroll', handler)
  })
})
```

- [ ] **Step 3: Run it, expect FAIL** (module not found)

Run: `pnpm --filter web test -- use-scroll-edges`

- [ ] **Step 4: Implement** `use-scroll-edges.ts`

```ts
'use client'

import {useLayoutEffect, useState} from 'react'
import type {RefObject} from 'react'

// Sub-pixel scroll positions on fractional-DPR screens would otherwise leave a permanent 1px "more content" fade.
const EDGE_TOLERANCE = 1

/** Whether a horizontally scrolling element has content hidden before its start / after its end. */
export function useScrollEdges<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [edges, setEdges] = useState({start: false, end: false})

  // Layout effect: the first paint after hydration already has the right fades.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > EDGE_TOLERANCE
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_TOLERANCE
      setEdges(prev => (prev.start === start && prev.end === end ? prev : {start, end}))
    }
    update()
    el.addEventListener('scroll', update, {passive: true})
    // Size changes (window resize, font load, longer translations) fire no scroll event.
    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [ref])

  return edges
}
```

- [ ] **Step 5: Run it, expect PASS**

Run: `pnpm --filter web test -- use-scroll-edges`

- [ ] **Step 6: Commit**

```bash
git add apps/web/jest.setup.ts apps/web/src/hooks/use-scroll-edges.ts apps/web/src/hooks/use-scroll-edges.test.ts
git commit -m "feat(web): add useScrollEdges hook"
```

---

### Task 2: `ScrollFade` component and CSS

**Files:**

- Create: `apps/web/src/components/scroll-fade.tsx`
- Test: `apps/web/src/components/scroll-fade.test.tsx`
- Modify: `apps/web/src/app/globals.css` (after the `* {scrollbar-width…}` rule, ~line 83)

**Interfaces:**

- Consumes: `useScrollEdges` from Task 1.
- Produces: `ScrollFade({className?: string, children: ReactNode})`: renders `<div class="scroll-fade-x …" data-fade-start="true|false" data-fade-end="true|false">`. Scrollbar hidden, overflow-x scrolls.

- [ ] **Step 1: Write the failing test** `scroll-fade.test.tsx`

```tsx
import {render, screen} from '@testing-library/react'

import {ScrollFade} from './scroll-fade'

function mockWidths(scrollWidth: number, clientWidth: number) {
  jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth)
}

describe('ScrollFade', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fades the end when content overflows', () => {
    mockWidths(500, 200)
    render(
      <ScrollFade>
        <span>a</span>
      </ScrollFade>
    )
    const root = screen.getByText('a').parentElement
    expect(root).toHaveAttribute('data-fade-start', 'false')
    expect(root).toHaveAttribute('data-fade-end', 'true')
  })

  it('shows no fade when content fits', () => {
    mockWidths(200, 200)
    render(
      <ScrollFade>
        <span>a</span>
      </ScrollFade>
    )
    const root = screen.getByText('a').parentElement
    expect(root).toHaveAttribute('data-fade-start', 'false')
    expect(root).toHaveAttribute('data-fade-end', 'false')
  })

  it('merges a custom class', () => {
    render(
      <ScrollFade className="gap-2">
        <span>a</span>
      </ScrollFade>
    )
    expect(screen.getByText('a').parentElement).toHaveClass('scroll-fade-x', 'gap-2')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter web test -- scroll-fade`

- [ ] **Step 3: Implement** `scroll-fade.tsx`

```tsx
'use client'

import {useScrollEdges} from '@/hooks/use-scroll-edges'
import {useRef} from 'react'
import type {ReactNode} from 'react'

/** Horizontal scroller with a hidden scrollbar; the edge that still has hidden content fades out. Styles: `.scroll-fade-x` in globals.css. */
export function ScrollFade({className = '', children}: {className?: string; children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null)
  const {start, end} = useScrollEdges(ref)
  return (
    <div
      ref={ref}
      data-fade-start={start}
      data-fade-end={end}
      className={`scroll-fade-x ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Add CSS** to `globals.css`, right after the `* { scrollbar-width … }` block:

```css
/* Scroller with no visible scrollbar. The side that still has hidden content fades out (set by ScrollFade). */
@property --fade-start {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}
@property --fade-end {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.scroll-fade-x {
  overflow-x: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--fade-start),
    #000 calc(100% - var(--fade-end)),
    transparent
  );
  transition:
    --fade-start 200ms ease-out,
    --fade-end 200ms ease-out;
}
.scroll-fade-x::-webkit-scrollbar {
  display: none;
}
.scroll-fade-x[data-fade-start='true'] {
  --fade-start: 40px;
}
.scroll-fade-x[data-fade-end='true'] {
  --fade-end: 40px;
}

@media (prefers-reduced-motion: reduce) {
  .scroll-fade-x {
    transition: none;
  }
}
```

The `*` rule above sets `scrollbar-width: thin`; `.scroll-fade-x` wins by specificity. If the build output lacks `-webkit-mask-image`, add it by hand (Safari < 15.4).

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter web test -- scroll-fade`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/scroll-fade.tsx apps/web/src/components/scroll-fade.test.tsx apps/web/src/app/globals.css
git commit -m "feat(web): add ScrollFade scroller with edge fades"
```

---

### Task 3: Use it in the server switcher

**Files:**

- Modify: `apps/web/src/features/catalog/components/catalog.tsx` (imports; the `role="group"` div and the pill row, ~lines 101-130)
- Test: `apps/web/src/features/catalog/components/catalog.test.tsx`

**Interfaces:**

- Consumes: `ScrollFade` from Task 2.

- [ ] **Step 1: Write the failing test.** Append inside `describe('Catalog server switcher', …)`:

```tsx
it('scrolls the selected server into view', () => {
  mockLocale = 'en'
  const scrollIntoView = jest.mocked(Element.prototype.scrollIntoView)
  scrollIntoView.mockClear()
  render(<Catalog initialServer="survival" />)
  scrollIntoView.mockClear() // ignore the initial mount
  fireEvent.click(screen.getByRole('button', {name: 'next'}))
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
  expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('button', {name: 'Anarchy'}))
})
```

- [ ] **Step 2: Run, expect FAIL** (`scrollIntoView` called 0 times)

Run: `pnpm --filter web test -- catalog.test`

- [ ] **Step 3: Implement.** In `catalog.tsx`:

1. Imports: add `import {ScrollFade} from '@/components/scroll-fade'` (before the `ProductCard` import, keep alphabetical-ish order the file uses) and change the React import to `import {useEffect, useRef, useState} from 'react'`.
2. After `const [filter, …]` add `const switcherRef = useRef<HTMLDivElement>(null)`.
3. After the accent `useEffect`, add:

```tsx
// The row can scroll when the pills do not fit; keep the selected one visible (chevrons, deep link).
useEffect(() => {
  switcherRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest'
  })
}, [server.slug])
```

4. On the `role="group"` div add `ref={switcherRef}`.
5. Replace `<div className="flex gap-2 overflow-x-auto p-1">` … `</div>` wrapper with `<ScrollFade className="flex min-w-0 scroll-smooth gap-2 p-1 motion-reduce:scroll-auto">` … `</ScrollFade>` (children unchanged). `min-w-0` lets the flex item shrink below its content so it actually scrolls; with room to spare it keeps its content width and stays centered by the parent's `justify-center`.

- [ ] **Step 4: Run, expect PASS** (all Catalog tests)

Run: `pnpm --filter web test -- catalog.test`

- [ ] **Step 5: Manual check** (jsdom has no layout; this is the real proof)

Run: `pnpm --filter web dev`, open `http://localhost:3000` in a browser.

1. Width 1440: all three pills visible, no fade, no scrollbar.
2. Width 320: row scrolls; right edge fades; swipe/shift+wheel/drag left reveals the rest, left fade appears, right fade disappears at the end; no scrollbar visible in Chrome, Firefox, Safari.
3. At 320, click the right chevron until Minigames: the pill scrolls into view.
4. Open `/minigames` directly at 320: Minigames pill is visible on load.
5. Tab through the pills with the keyboard: focused pill scrolls into view.
6. DevTools → emulate `prefers-reduced-motion: reduce`: scrolling is instant, fade does not animate.

- [ ] **Step 6: Gate and commit**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`

```bash
git add apps/web/src/features/catalog/components/catalog.tsx apps/web/src/features/catalog/components/catalog.test.tsx
git commit -m "feat(web): scrollable server switcher with edge fades"
```

Then run `graphify update .`.

---

## Self-Review

- **Coverage:** scroll when space is short (Task 3 `min-w-0` + `overflow-x`), hint that more exists (edge-only fade, Task 2), hidden scrollbar (Task 2 CSS), partially visible pill cut by the fade (mask fades the last pill instead of a hard clip), active pill kept visible (Task 3).
- **Placeholders:** none.
- **Types:** `useScrollEdges` returns `{start, end}` in Tasks 1 and 2; `ScrollFade` props match their use in Task 3.
