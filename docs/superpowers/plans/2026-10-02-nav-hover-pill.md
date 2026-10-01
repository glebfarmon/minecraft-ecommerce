# Nav Hover Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop, hovering a main nav link shows a soft pill behind it; moving the cursor to another link slides the same pill over; leaving the link row fades it out. Hover only: no pill for the active route.

**Architecture:** Motion's shared-layout animation (`layoutId`) is the ready-made solution: each link renders `<motion.span layoutId="nav-hover-pill">` only while it is hovered, and Motion animates the box from the previous link's position to the new one with a transform. The desktop link list moves out of `navbar.tsx` into a focused `NavLinks` component that owns the `hovered` state. `motion` is already a dependency (`motion/react`, used in `catalog.tsx` and `product-modal.tsx`); nothing new is installed and no shadcn component is needed.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Motion 13 (`motion/react`), Jest + Testing Library (unit), Playwright (e2e).

**Spec:** `navigation.md` (repo root, reference markup) + `docs/design-system.md` §6 Navbar and §8 Motion.

## Reference analysis (`navigation.md`)

| Part     | Reference                                                                                | Ours                                                                |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Link box | `relative flex items-center justify-center px-4 h-11`                                    | same; replaces today's `gap-8` with `px-4` so hover areas touch     |
| Text     | `relative z-10`, 13px, uppercase, `tracking-[0.14em]`, `text-white/45`                   | keep ours: `font-semibold text-muted hover:text-fg` (design tokens) |
| Pill     | `absolute inset-y-1 inset-x-0 rounded-full bg-white/[0.07]`, inset 1px ring `white/0.05` | identical classes, `aria-hidden`                                    |
| Motion   | pill `opacity` animated, position moves with `transform`                                 | `layoutId` (transform) + `AnimatePresence` for fade in/out          |

Spacing stays the same: `gap-8` (32px between labels) becomes `px-4` + `px-4` (32px), with no dead zone between links, so the pill never blinks out while sliding.

## Global Constraints

- Do not add dependencies. Use `motion/react` (already installed, `motion@^13.4.6`).
- Wrap animated UI in `<MotionConfig reducedMotion="user">`, as `catalog.tsx:55` and `product-modal.tsx:36` do: with `prefers-reduced-motion`, the slide is dropped, the opacity fade stays.
- Colors: pill uses the reference's `bg-white/[0.07]` and `rgb(255 255 255/0.05)` ring (same white-alpha family as existing `hover:bg-white/5` in `navbar.tsx`). Text uses `@theme` tokens `text-muted` / `text-fg` only.
- Desktop only (`lg:` and up); the mobile full-screen menu is unchanged.
- Pre-commit gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Uncommitted unrelated changes exist (`apps/web/messages/en.json`, `apps/web/messages/pl.json`, `apps/web/src/components/hero.tsx`, `navigation.md`): never `git add` them. Stage files by path.
- After code changes run `graphify update .` from the repo root.

## Review Focus

1. **Cursor crosses from one link to the next:** the pill must slide, not fade out and back in. Requires no gap between hover targets. Pinned by unit test "moves the pill to the next hovered link" (Task 1) and e2e "pill slides between links" (Task 2), which asserts the pill ends under the new link with only one pill left; the slide itself (no blink) is checked by eye in Task 2 Step 4.
2. **Cursor leaves the link row** (to the logo, cart, or off the navbar): pill must disappear, not stick on the last link. Pinned by unit test "removes the pill when the cursor leaves the list" (Task 1) and the e2e test's final step (Task 2).
3. **Clicking a link to the current page** must still scroll to top (existing `scrollToTopIfCurrent`). Pinned by unit test "forwards clicks with the link href" (Task 1).
4. **Navbar shrinks into the floating pill while hovered** (user scrolls with cursor on a link): the hover pill is `absolute inset-x-0` inside its link, so it follows the link with no re-measure. Checked manually in Task 2 Step 4.
5. **Keyboard users:** pill is hover-only by request; Tab focus must still show the browser focus outline on the link. Checked manually in Task 2 Step 4.

---

## File Structure

| File                                         | Action                       | Responsibility                                |
| -------------------------------------------- | ---------------------------- | --------------------------------------------- |
| `apps/web/src/components/nav-links.tsx`      | Create                       | Desktop link row + hover state + sliding pill |
| `apps/web/src/components/nav-links.test.tsx` | Create                       | Unit tests (jsdom)                            |
| `apps/web/src/components/navbar.tsx`         | Modify (lines 3-14, 77-90)   | Replace inline `<ul>` with `<NavLinks>`       |
| `e2e/tests/navbar.spec.ts`                   | Modify (append)              | Browser test of the slide                     |
| `docs/design-system.md`                      | Modify (§6 Navbar, bullet 2) | Document the hover pill                       |

---

### Task 1: `NavLinks` with sliding hover pill

**Files:**

- Create: `apps/web/src/components/nav-links.tsx`
- Create: `apps/web/src/components/nav-links.test.tsx`
- Modify: `apps/web/src/components/navbar.tsx:3-14` (imports), `:77-90` (desktop `<ul>`)
- Modify: `docs/design-system.md:157`

**Interfaces:**

- Consumes: `Link` from `@/i18n/navigation`; `scrollToTopIfCurrent(event, href)` already defined in `Navbar` (`navbar.tsx:29`).
- Produces:
  - `export type NavLinkItem = {href: string; label: string}`
  - `export function NavLinks(props: {links: NavLinkItem[]; onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void}): JSX.Element`
  - DOM contract used by Task 2: the pill is a `<span data-nav-pill aria-hidden="true">` rendered inside the hovered `<a>`; at most one is visible after animations settle.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/nav-links.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import type {ComponentProps} from 'react'

import {NavLinks} from './nav-links'

// The real Link needs the next-intl router; a plain anchor is enough to test hover state.
jest.mock('@/i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />
}))

const links = [
  {href: '/', label: 'Home'},
  {href: '/cases', label: 'Cases'},
  {href: '/rules', label: 'Rules'}
]

const pills = () => document.querySelectorAll('[data-nav-pill]')
const pillIn = (name: string) => screen.getByRole('link', {name}).querySelector('[data-nav-pill]')

describe('NavLinks', () => {
  it('shows no pill until a link is hovered', () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    expect(pills()).toHaveLength(0)
  })

  it('shows the pill behind the hovered link', () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    expect(pillIn('Cases')).not.toBeNull()
    expect(pillIn('Cases')).toHaveAttribute('aria-hidden', 'true')
  })

  it('moves the pill to the next hovered link', async () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Rules'}))
    expect(pillIn('Rules')).not.toBeNull()
    await waitFor(() => {
      expect(pills()).toHaveLength(1)
    })
    expect(pillIn('Cases')).toBeNull()
  })

  it('removes the pill when the cursor leaves the list', async () => {
    render(<NavLinks links={links} onLinkClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('link', {name: 'Cases'}))
    fireEvent.mouseLeave(screen.getByRole('list'))
    await waitFor(() => {
      expect(pills()).toHaveLength(0)
    })
  })

  it('forwards clicks with the link href', () => {
    const onLinkClick = jest.fn()
    render(<NavLinks links={links} onLinkClick={onLinkClick} />)
    fireEvent.click(screen.getByRole('link', {name: 'Rules'}))
    expect(onLinkClick).toHaveBeenCalledWith(expect.anything(), '/rules')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @shop/web test -- nav-links`
Expected: FAIL with `Cannot find module './nav-links'`.

- [ ] **Step 3: Implement `NavLinks`**

Create `apps/web/src/components/nav-links.tsx`:

```tsx
'use client'

import {Link} from '@/i18n/navigation'
import {AnimatePresence, LayoutGroup, MotionConfig, motion} from 'motion/react'
import type {MouseEvent} from 'react'
import {useState} from 'react'

export type NavLinkItem = {href: string; label: string}

export function NavLinks({
  links,
  onLinkClick
}: {
  links: NavLinkItem[]
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="main-nav">
        {/* Links touch (padding, no gap), so the cursor never falls between them and the pill slides instead of blinking. */}
        <ul
          onMouseLeave={() => {
            setHovered(null)
          }}
          className="mx-auto hidden items-center lg:flex">
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                onMouseEnter={() => {
                  setHovered(link.href)
                }}
                onClick={event => {
                  onLinkClick(event, link.href)
                }}
                className="text-muted hover:text-fg relative flex h-11 items-center justify-center px-4 text-[13px] font-semibold tracking-[0.14em] uppercase transition-colors">
                <AnimatePresence>
                  {hovered === link.href && (
                    <motion.span
                      layoutId="nav-hover-pill"
                      data-nav-pill
                      aria-hidden="true"
                      initial={{opacity: 0}}
                      animate={{opacity: 1}}
                      exit={{opacity: 0}}
                      transition={{type: 'spring', bounce: 0.15, duration: 0.35}}
                      className="absolute inset-x-0 inset-y-1 rounded-full bg-white/[0.07] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]"
                    />
                  )}
                </AnimatePresence>
                <span className="relative z-10">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </MotionConfig>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @shop/web test -- nav-links`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire into `Navbar`**

In `apps/web/src/components/navbar.tsx`, add the import (keep alphabetical order with the other `@/components/*` imports):

```tsx
import {NavLinks} from '@/components/nav-links'
```

Replace lines 77-90 (the whole desktop `<ul className="mx-auto hidden items-center gap-8 lg:flex">…</ul>`) with:

```tsx
<NavLinks links={links} onLinkClick={scrollToTopIfCurrent} />
```

`links` and `scrollToTopIfCurrent` stay in `Navbar`: the mobile menu (lines 130-144) still uses both.

- [ ] **Step 6: Update the design doc**

In `docs/design-system.md` §6 Navbar, replace bullet 2 (line 157):

```markdown
- Слева лого. По центру: Home, Donate Cases, Rules, Contacts (`text-nav`, `--color-fg-muted`, активный — `--color-fg`).
```

with:

```markdown
- Слева лого. По центру: Home, Donate Cases, Rules, Contacts (`text-nav`, `--color-fg-muted`, активный — `--color-fg`). Ссылки `h-11 px-4` вплотную друг к другу. При hover за ссылкой появляется пилюля (`inset-y-1`, `rounded-full`, `rgb(255 255 255 / 0.07)`, внутреннее кольцо 1px `rgb(255 255 255 / 0.05)`); при переходе на соседнюю ссылку та же пилюля переезжает к ней (Motion `layoutId`, spring 350ms), при уходе курсора с ряда ссылок — гаснет. Только hover, активная страница пилюлю не держит. `prefers-reduced-motion` — без переезда, только fade.
```

- [ ] **Step 7: Full gate**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass. If `format:check` fails only on the new files, run `pnpm exec prettier --write apps/web/src/components/nav-links.tsx apps/web/src/components/nav-links.test.tsx apps/web/src/components/navbar.tsx docs/design-system.md docs/superpowers/plans/2026-10-02-nav-hover-pill.md` and re-run.

- [ ] **Step 8: Update graph and commit**

```bash
graphify update .
git add apps/web/src/components/nav-links.tsx apps/web/src/components/nav-links.test.tsx apps/web/src/components/navbar.tsx docs/design-system.md docs/superpowers/plans/2026-10-02-nav-hover-pill.md
git commit -m "feat(web): slide a hover pill between nav links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: E2E check of the slide in a real browser

jsdom has no layout, so only a browser can prove the pill moves sideways instead of jumping.

**Files:**

- Modify: `e2e/tests/navbar.spec.ts` (append one test)

**Interfaces:**

- Consumes: Task 1 DOM contract — `[data-nav-pill]` inside the hovered link of `<nav aria-label="Main">`; `data-animate` on `<nav>` marks hydration (existing).
- Produces: nothing.

- [ ] **Step 1: Write the test**

Append to `e2e/tests/navbar.spec.ts` (the file already sets a 1600×900 viewport, so the desktop links are visible):

```ts
test('pill slides between links on hover and hides on leave', async ({page}) => {
  await page.goto(`${WEB}/`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  await expect(nav).toHaveAttribute('data-animate')
  const pill = nav.locator('[data-nav-pill]')
  const pillX = async () => (await pill.first().boundingBox())?.x ?? -1

  await expect(pill).toHaveCount(0)

  const links = nav.getByRole('list').getByRole('link')
  await links.nth(1).hover()
  await expect(pill).toHaveCount(1)
  const firstX = await pillX()

  await links.nth(2).hover()
  // The pill ends exactly under the new link (inset-x-0), and there is still only one.
  const target = (await links.nth(2).boundingBox())?.x ?? 0
  await expect.poll(pillX).toBeGreaterThan(firstX)
  await expect.poll(pillX).toBeCloseTo(target, 0)
  await expect(pill).toHaveCount(1)

  await page.mouse.move(5, 450)
  await expect(pill).toHaveCount(0)
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @shop/e2e test:e2e -- navbar`
Expected: PASS (3 tests: two existing + this one). Needs the web app running at `WEB_URL` (default `http://shop.localhost`), the same setup the existing navbar tests use.

- [ ] **Step 3: Full gate**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass.

- [ ] **Step 4: Manual check in the browser**

Run `pnpm dev`, open `http://localhost:3000` at ≥1024px width, and check:

1. Hover Home, then sweep right across all links: one pill slides, never blinks out between links.
2. Move the cursor from a link to the logo / cart: pill fades out.
3. With the cursor resting on a link, scroll the page: navbar shrinks to the floating pill and the hover pill stays centered under its link.
4. Press Tab into the nav: the focus outline is visible on each link (no hover pill is expected).
5. DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce": pill jumps between links with a fade, no slide.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/navbar.spec.ts
git commit -m "test(e2e): cover the nav hover pill slide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
