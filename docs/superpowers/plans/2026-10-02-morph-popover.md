# Morph Popover (Container Transform) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reusable `MorphPopover` where a small trigger (pill or circle) visibly grows into a panel and shrinks back (Material "Container Transform"), used first by the navbar's language/currency button and the cart button.

**Architecture:** One domain-free component in `components/` uses Motion's shared-layout animation: the trigger `motion.button` and the open panel `motion.div` carry the same `layoutId`, so Motion animates one box from the trigger's rect to the panel's rect and back. The panel is `absolute` inside a wrapper whose size is held by an invisible ghost of the trigger, so the navbar never reflows. Panel content fades in with a blur after the box starts moving (as in `animate/animate-3.png`). The two navbar widgets move out of `navbar.tsx` into `features/settings` and `features/cart` and become thin users of `MorphPopover`. `motion` is already a dependency; nothing new is installed.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Motion 13 (`motion/react`), next-intl, Jest + Testing Library, Playwright.

**Spec:** No design doc. Sources: the request in chat, reference frames `animate/animate-1.png` … `animate-4.png` (collapsed pill → expanded card, content blurs in), `docs/adr/0004-frontend-structure.md` (placement rules), `docs/superpowers/plans/2026-10-02-nav-hover-pill.md` (same Motion conventions).

## Global Constraints

- Frontend layout per ADR 0004: domain-free code in `src/components/` (must NOT import `features/`, `app/`, `store/`); domain code in `src/features/<name>/`; app imports features, never the reverse; no barrel files; tests next to the code.
- Motion is imported from `motion/react` and wrapped in `<MotionConfig reducedMotion="user">` (existing convention).
- Money is `amountMinor` + currency, formatted only through `formatPrice` (unchanged here).
- Every user-visible string goes through next-intl; `messages/en.json` and `messages/pl.json` must keep identical keys (`src/i18n/messages.test.ts`).
- Do not bump ESLint (9) or TypeScript (6).
- TDD; Conventional Commits; before the last commit run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` from the repo root.
- `apps/web/src/app/[locale]/_components/navbar.tsx` has **uncommitted user changes** (the `xl:grid xl:grid-cols-[1fr_auto_1fr]` navbar layout). Keep them. When committing that file use `git add -p` and stage only the hunks you made. Leave the untracked `animate/` folder alone.
- Shell note (zsh): quote paths containing `[locale]`.

## Review Focus

1. **Two `SettingsMenu` instances are mounted at once** (desktop navbar and the mobile overlay): they must not share a `layoutId` or open together. Pinned by the "separate instances" test in Task 1.
2. **Keyboard users:** opening moves focus into the panel; Escape closes and returns focus to the trigger (the trigger node is re-created on close). Pinned by Task 1 tests.
3. **Opening the cart while the language panel is open** closes the other one (outside pointer-down). Pinned by the e2e test in Task 4.
4. **Cart panel on a 375px phone** must stay inside the viewport (trigger sits left of the burger button, panel aligns to its right edge). Pinned by the e2e test in Task 4.
5. **Prefers-reduced-motion / jsdom without layout:** open and close must still work when no animation runs. Pinned by the Task 1 tests (jsdom has no layout, nothing animates) and by `reducedMotion="user"`.

---

## File Structure

| File                                                            | Responsibility                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/components/morph-popover.tsx` (new)                        | Generic trigger ⇄ panel container transform: layout animation, dismiss, focus, a11y |
| `src/components/morph-popover.test.tsx` (new)                   | Behavior tests for the above                                                        |
| `src/features/settings/components/settings-menu.tsx` (new)      | Language + currency picker built on `MorphPopover`                                  |
| `src/features/settings/components/settings-menu.test.tsx` (new) | Picker tests                                                                        |
| `src/features/cart/components/cart-menu.tsx` (new)              | Cart button + panel built on `MorphPopover`                                         |
| `src/features/cart/components/cart-menu.test.tsx` (new)         | Cart tests                                                                          |
| `src/app/[locale]/_components/navbar.tsx` (modify)              | Drop the inline `SettingsMenu`, `MenuItem`, `CartButton`; import the new ones       |
| `messages/en.json`, `messages/pl.json` (modify)                 | New key `nav.closePanel`                                                            |
| `e2e/tests/morph-popover.spec.ts` (new)                         | Real-browser morph, dismiss, and phone-viewport checks                              |

All paths under `apps/web/` except `e2e/`.

---

### Task 1: `MorphPopover` component

**Files:**

- Create: `apps/web/src/components/morph-popover.tsx`
- Test: `apps/web/src/components/morph-popover.test.tsx`

**Interfaces:**

- Consumes: `useDismiss(ref, open, close)` from `@/hooks/use-dismiss`.
- Produces:

  ```ts
  export function MorphPopover(props: {
    triggerLabel: string // aria-label of the collapsed button
    panelLabel: string // accessible name of the dialog
    closeLabel: string // aria-label of the X button inside the panel
    trigger: ReactNode // collapsed content (icon, text…)
    triggerClassName?: string // box styling of the collapsed button: size, border, background, text color. No radius: it is fixed at 22px.
    panelClassName?: string // box styling of the panel: width, max-height, overflow. Surface styles are built in.
    anchor?: 'top-end' | 'bottom-end' // default 'top-end': the panel's top-right corner sits on the trigger's, growing down-left; 'bottom-end' grows up-left
    children: (close: () => void) => ReactNode // panel content
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/morph-popover.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {MorphPopover} from './morph-popover'

function Demo({name = 'Open settings'}: {name?: string}) {
  return (
    <MorphPopover
      triggerLabel={name}
      panelLabel={`${name} panel`}
      closeLabel="Close"
      trigger={<span>Open</span>}
      triggerClassName="h-11 px-4"
      panelClassName="w-64">
      {close => (
        <button type="button" onClick={close}>
          Done
        </button>
      )}
    </MorphPopover>
  )
}

const trigger = (name = 'Open settings') => screen.getByRole('button', {name})
const panel = (name = 'Open settings panel') => screen.getByRole('dialog', {name})
const gone = async (name = 'Open settings panel') => {
  await waitFor(() => {
    expect(screen.queryByRole('dialog', {name})).toBeNull()
  })
}

describe('MorphPopover', () => {
  it('starts collapsed: a trigger and no panel', () => {
    render(<Demo />)
    expect(trigger()).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the panel on click and swaps the trigger out', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    expect(panel()).toBeInTheDocument()
    // The ghost that holds the trigger's space is hidden from assistive tech.
    expect(screen.queryByRole('button', {name: 'Open settings'})).toBeNull()
  })

  it('moves focus into the panel when it opens', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    expect(panel()).toHaveFocus()
  })

  it('closes on Escape and gives focus back to the trigger', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.keyDown(document, {key: 'Escape'})
    await gone()
    await waitFor(() => {
      expect(trigger()).toHaveFocus()
    })
  })

  it('closes on a pointer-down outside', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.pointerDown(document.body)
    await gone()
  })

  it('stays open on a pointer-down inside the panel', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.pointerDown(panel())
    expect(panel()).toBeInTheDocument()
  })

  it('closes from the X button', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', {name: 'Close'}))
    await gone()
  })

  it('hands children a close function', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', {name: 'Done'}))
    await gone()
  })

  // The navbar mounts the settings menu twice (desktop bar and mobile overlay).
  it('keeps separate instances independent', () => {
    render(
      <>
        <Demo name="First" />
        <Demo name="Second" />
      </>
    )
    fireEvent.click(trigger('First'))
    expect(panel('First panel')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', {name: 'Second panel'})).toBeNull()
    expect(trigger('Second')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @shop/web test -- morph-popover`
Expected: FAIL, "Cannot find module './morph-popover'".

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/morph-popover.tsx`:

```tsx
'use client'

import {useDismiss} from '@/hooks/use-dismiss'
import {X} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion} from 'motion/react'
import type {ReactNode} from 'react'
import {useCallback, useEffect, useId, useRef, useState} from 'react'

// Trigger and panel share one radius (half of the 44px trigger), so Motion never has to morph corners.
const RADIUS = 22
const MORPH = {type: 'spring', bounce: 0.1, duration: 0.45} as const

const ANCHOR = {'top-end': 'top-0 right-0', 'bottom-end': 'right-0 bottom-0'} as const

type Props = {
  triggerLabel: string
  panelLabel: string
  closeLabel: string
  trigger: ReactNode
  triggerClassName?: string
  panelClassName?: string
  anchor?: keyof typeof ANCHOR
  children: (close: () => void) => ReactNode
}

/**
 * Container transform: the trigger and the panel are one `layoutId`, so Motion animates a single
 * box from the trigger's rect to the panel's rect and back. The panel is absolutely positioned, so
 * an invisible ghost of the trigger keeps its space and the surrounding layout does not move.
 */
export function MorphPopover({
  triggerLabel,
  panelLabel,
  closeLabel,
  trigger,
  triggerClassName = '',
  panelClassName = '',
  anchor = 'top-end',
  children
}: Props) {
  const [open, setOpen] = useState(false)
  // Trigger content fades in only when it returns from the panel, not on first paint.
  const [everOpened, setEverOpened] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const close = useCallback(() => {
    setOpen(false)
  }, [])
  useDismiss(root, open, close)

  useEffect(() => {
    if (open) panelRef.current?.focus()
    else if (wasOpen.current) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <MotionConfig reducedMotion="user">
      <div ref={root} className="relative">
        {open ? (
          <div
            aria-hidden="true"
            inert
            className={`invisible inline-flex items-center justify-center ${triggerClassName}`}
            style={{borderRadius: RADIUS}}>
            <span className="inline-flex items-center gap-2">{trigger}</span>
          </div>
        ) : (
          <motion.button
            ref={triggerRef}
            type="button"
            layoutId={id}
            transition={MORPH}
            style={{borderRadius: RADIUS}}
            onClick={() => {
              setEverOpened(true)
              setOpen(true)
            }}
            aria-haspopup="dialog"
            aria-label={triggerLabel}
            className={`inline-flex items-center justify-center transition-colors duration-300 ${triggerClassName}`}>
            <motion.span
              initial={everOpened ? {opacity: 0} : false}
              animate={{opacity: 1}}
              transition={{delay: 0.15, duration: 0.2}}
              className="inline-flex items-center gap-2">
              {trigger}
            </motion.span>
          </motion.button>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label={panelLabel}
              tabIndex={-1}
              layoutId={id}
              transition={MORPH}
              style={{borderRadius: RADIUS}}
              className={`border-border bg-surface absolute z-50 border shadow-[0_24px_48px_rgb(0_0_0/0.5)] transition-colors duration-300 outline-none ${ANCHOR[anchor]} ${panelClassName}`}>
              <motion.div
                initial={{opacity: 0, filter: 'blur(6px)'}}
                animate={{
                  opacity: 1,
                  filter: 'blur(0px)',
                  transition: {delay: 0.12, duration: 0.25}
                }}
                exit={{opacity: 0, filter: 'blur(6px)', transition: {duration: 0.1}}}
                className="relative p-4">
                {children(close)}
                <button
                  type="button"
                  onClick={close}
                  aria-label={closeLabel}
                  className="text-muted hover:text-fg absolute top-3 right-3 grid size-8 place-items-center rounded-full hover:bg-white/5">
                  <X className="size-4" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @shop/web test -- morph-popover`
Expected: PASS, 9 tests. If "moves focus" fails because the panel is not yet in the DOM when the effect runs, `panelRef` is attached in the same commit as `open`, so check that the ref is on the `motion.div` and not on the inner wrapper.

- [ ] **Step 5: Lint and commit**

Run: `pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck`
Expected: no errors (the file lives in `components/`, so it must not import `features/`).

```bash
git add apps/web/src/components/morph-popover.tsx apps/web/src/components/morph-popover.test.tsx
git commit -m "feat(web): add MorphPopover container-transform component"
```

---

### Task 2: Language and currency menu on `MorphPopover`

**Files:**

- Create: `apps/web/src/features/settings/components/settings-menu.tsx`
- Test: `apps/web/src/features/settings/components/settings-menu.test.tsx`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/pl.json` (key `nav.closePanel`)

**Interfaces:**

- Consumes: `MorphPopover` (Task 1); `useShop()` → `{currency, setCurrency}` from `@/features/cart/shop-provider`; `usePathname`, `useRouter` from `@/i18n/navigation`; `routing.locales` from `@/i18n/routing`; `Currency` from `@/lib/catalog`.
- Produces: `export function SettingsMenu({anchor}: {anchor?: 'top-end' | 'bottom-end'})` (default `'top-end'`).

- [ ] **Step 1: Add the message key**

In `apps/web/messages/en.json`, inside `"nav"`, after `"settings"`:

```json
    "closePanel": "Close",
```

In `apps/web/messages/pl.json`, same place:

```json
    "closePanel": "Zamknij",
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/features/settings/components/settings-menu.test.tsx`:

```tsx
import {ShopProvider} from '@/features/cart/shop-provider'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {SettingsMenu} from './settings-menu'

const mockReplace = jest.fn()
// next-intl and the routing config are ESM-only; keys stand in for translated text.
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/cases',
  useRouter: () => ({replace: mockReplace})
}))
jest.mock('@/i18n/routing', () => ({routing: {locales: ['en', 'pl']}}))

const setup = () =>
  render(
    <ShopProvider>
      <SettingsMenu />
    </ShopProvider>
  )
const trigger = () => screen.getByRole('button', {name: 'settings'})
const open = () => {
  fireEvent.click(trigger())
}

describe('SettingsMenu', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    localStorage.clear()
  })

  it('shows the current language and currency symbol on the trigger', () => {
    setup()
    expect(trigger()).toHaveTextContent('EN')
    expect(trigger()).toHaveTextContent('€')
  })

  it('marks the current language and currency as checked', () => {
    setup()
    open()
    expect(screen.getByRole('radio', {name: /English/})).toBeChecked()
    expect(screen.getByRole('radio', {name: /Polski/})).not.toBeChecked()
    expect(screen.getByRole('radio', {name: /EUR/})).toBeChecked()
  })

  it('switches the locale in place and closes', async () => {
    setup()
    open()
    fireEvent.click(screen.getByRole('radio', {name: /Polski/}))
    expect(mockReplace).toHaveBeenCalledWith('/cases', {locale: 'pl', scroll: false})
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('switches the currency and closes', async () => {
    setup()
    open()
    fireEvent.click(screen.getByRole('radio', {name: /PLN/}))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(trigger()).toHaveTextContent('zł')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @shop/web test -- settings-menu`
Expected: FAIL, "Cannot find module './settings-menu'".

- [ ] **Step 4: Write the component**

Create `apps/web/src/features/settings/components/settings-menu.tsx` (the markup and strings are moved from `navbar.tsx`; items become `role="radio"` because the container is now a dialog, not a `menu`):

```tsx
'use client'

import {MorphPopover} from '@/components/morph-popover'
import {useShop} from '@/features/cart/shop-provider'
import {usePathname, useRouter} from '@/i18n/navigation'
import {routing} from '@/i18n/routing'
import type {Currency} from '@/lib/catalog'
import {Check, Globe} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

const LANGUAGE_NAMES: Record<string, string> = {en: 'English', pl: 'Polski'}
const CURRENCIES: {code: Currency; symbol: string}[] = [
  {code: 'EUR', symbol: '€'},
  {code: 'PLN', symbol: 'zł'}
]

export function SettingsMenu({anchor = 'top-end'}: {anchor?: 'top-end' | 'bottom-end'}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const {currency, setCurrency} = useShop()

  const symbol = CURRENCIES.find(c => c.code === currency)?.symbol

  return (
    <MorphPopover
      anchor={anchor}
      triggerLabel={t('settings')}
      panelLabel={t('settings')}
      closeLabel={t('closePanel')}
      triggerClassName="h-11 border border-border px-4 text-sm font-medium hover:border-white/25"
      panelClassName="w-64"
      trigger={
        <>
          <Globe className="text-muted size-4" />
          <span className="uppercase">{locale}</span>
          <span className="text-muted">·</span>
          <span>{symbol}</span>
        </>
      }>
      {close => (
        <>
          <p className="text-muted px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {t('language')}
          </p>
          <div role="radiogroup" aria-label={t('language')}>
            {routing.locales.map(code => (
              <Option
                key={code}
                code={code.toUpperCase()}
                label={LANGUAGE_NAMES[code] ?? code}
                selected={code === locale}
                onSelect={() => {
                  close()
                  router.replace(pathname, {locale: code, scroll: false})
                }}
              />
            ))}
          </div>
          <div className="bg-line mx-3 my-2 h-px" />
          <p className="text-muted px-3 pt-1 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {t('currency')}
          </p>
          <div role="radiogroup" aria-label={t('currency')}>
            {CURRENCIES.map(c => (
              <Option
                key={c.code}
                code={c.symbol}
                label={c.code}
                selected={c.code === currency}
                onSelect={() => {
                  setCurrency(c.code)
                  close()
                }}
              />
            ))}
          </div>
        </>
      )}
    </MorphPopover>
  )
}

function Option({
  code,
  label,
  selected,
  onSelect
}: {
  code: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-white/5 ${
        selected ? 'bg-white/[0.06]' : ''
      }`}>
      <span className="text-muted w-7 text-xs font-semibold">{code}</span>
      <span className="flex-1">{label}</span>
      {selected && <Check className="text-online size-4" />}
    </button>
  )
}
```

Note: the panel's X button sits at the top-right of the panel; the "Language" caption is short, so they do not collide at `w-64`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @shop/web test -- settings-menu messages`
Expected: PASS (settings tests and the en/pl key parity test).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/settings apps/web/messages/en.json apps/web/messages/pl.json
git commit -m "feat(web): build the language and currency menu on MorphPopover"
```

---

### Task 3: Cart menu on `MorphPopover` and navbar wiring

**Files:**

- Create: `apps/web/src/features/cart/components/cart-menu.tsx`
- Test: `apps/web/src/features/cart/components/cart-menu.test.tsx`
- Modify: `apps/web/src/app/[locale]/_components/navbar.tsx`

**Interfaces:**

- Consumes: `MorphPopover` (Task 1), `SettingsMenu({anchor})` (Task 2), `useShop()` → `{lines, count, currency, remove, add}`, `formatPrice(minor, currency, locale)` and `products` from `@/lib/catalog`.
- Produces: `export function CartMenu()`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/features/cart/components/cart-menu.test.tsx`:

```tsx
import {useShop} from '@/features/cart/shop-provider'
import {ShopProvider} from '@/features/cart/shop-provider'
import {products} from '@/lib/catalog'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {CartMenu} from './cart-menu'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const product = products[0]!

function AddProduct() {
  const {add} = useShop()
  return (
    <button
      type="button"
      onClick={() => {
        add(product)
      }}>
      add-product
    </button>
  )
}

const setup = () =>
  render(
    <ShopProvider>
      <AddProduct />
      <CartMenu />
    </ShopProvider>
  )
const open = () => {
  fireEvent.click(screen.getByRole('button', {name: 'label'}))
}

describe('CartMenu', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the empty state and a disabled checkout', () => {
    setup()
    open()
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'checkout'})).toBeDisabled()
  })

  it('shows the item count badge on the trigger', () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    expect(screen.getByRole('button', {name: 'label'})).toHaveTextContent('1')
  })

  it('lists the added product and removes it', async () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    open()
    expect(screen.getByText(product.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'remove'}))
    await waitFor(() => {
      expect(screen.getByText('empty')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @shop/web test -- cart-menu`
Expected: FAIL, "Cannot find module './cart-menu'". (If `products[0]!` trips `no-non-null-assertion` in lint, replace with `const [product] = products` plus `if (!product) throw new Error('catalog is empty')`.)

- [ ] **Step 3: Write the component**

Create `apps/web/src/features/cart/components/cart-menu.tsx` (markup moved from `CartButton` in `navbar.tsx`; the title gets right padding so it clears the X button):

```tsx
'use client'

import {MorphPopover} from '@/components/morph-popover'
import {useShop} from '@/features/cart/shop-provider'
import {formatPrice} from '@/lib/catalog'
import {ShoppingBag, X} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

export function CartMenu() {
  const t = useTranslations('cart')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const {lines, count, currency, remove} = useShop()

  const total = lines.reduce((sum, l) => sum + l.product.price[currency] * l.qty, 0)

  return (
    <MorphPopover
      triggerLabel={t('label', {count})}
      panelLabel={t('title')}
      closeLabel={tNav('closePanel')}
      triggerClassName="relative size-11 bg-fg text-ink"
      // Below lg the burger button sits to the right of the cart, so leave room for it (3.75rem).
      panelClassName="w-[min(22rem,calc(100vw-2*var(--gutter)-3.75rem))] max-h-[calc(100svh-6rem)] overflow-y-auto"
      trigger={
        <>
          <ShoppingBag className="size-[18px]" />
          {count > 0 && (
            <span className="tabular bg-accent text-on-accent absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold">
              {count}
            </span>
          )}
        </>
      }>
      {() => (
        <>
          <p className="pr-10 text-sm font-semibold">{t('title')}</p>
          {lines.length === 0 ? (
            <p className="text-muted mt-3 text-sm">{t('empty')}</p>
          ) : (
            <>
              <ul className="divide-line mt-3 flex flex-col divide-y">
                {lines.map(({product, qty}) => (
                  <li
                    key={`${product.server}/${product.slug}`}
                    className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                        {qty > 1 && <span className="tabular text-muted"> ×{qty}</span>}
                      </p>
                      <p className="text-muted text-xs capitalize">{product.server}</p>
                    </div>
                    <span className="tabular text-sm">
                      {formatPrice(product.price[currency] * qty, currency, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        remove(product)
                      }}
                      aria-label={t('remove', {name: product.name})}
                      className="text-muted hover:text-fg grid size-8 place-items-center rounded-full hover:bg-white/5">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-line mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted">{t('total')}</span>
                <span className="tabular font-display text-xl font-semibold">
                  {formatPrice(total, currency, locale)}
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            disabled
            title={t('checkoutSoon')}
            className="bg-accent text-on-accent mt-4 h-11 w-full rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            {t('checkout')}
          </button>
          <p className="text-muted mt-2 text-center text-xs">{t('checkoutSoon')}</p>
        </>
      )}
    </MorphPopover>
  )
}
```

Cart trigger has an `absolute` badge: the trigger button is `relative` via `triggerClassName`, so the badge stays anchored to the button even though the content sits in a wrapper span.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @shop/web test -- cart-menu`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the navbar**

Edit `apps/web/src/app/[locale]/_components/navbar.tsx`:

1. Delete the functions `SettingsMenu`, `MenuItem`, `CartButton` and the constants `LANGUAGE_NAMES`, `CURRENCIES` (everything below `Navbar`).
2. Imports: add
   ```ts
   import {CartMenu} from '@/features/cart/components/cart-menu'
   import {SettingsMenu} from '@/features/settings/components/settings-menu'
   ```
   and remove everything ESLint now reports as unused: `useShop`, `useDismiss`, `useRouter`, `routing`, `Currency`, `formatPrice`, `Check`, `ChevronDown`, `Globe`, `ShoppingBag`, `useLocale`, `useCallback`, `useRef`. Keep `Menu`, `X`, `useTranslations`, `useScrolled`, `OnlineDot`, `networkOnline`, `NavLinks`, `Link`, `usePathname`.
3. JSX: replace `<CartButton />` with `<CartMenu />`, and in the mobile overlay replace `<SettingsMenu placement="top" />` with `<SettingsMenu anchor="bottom-end" />`. The desktop `<SettingsMenu />` stays as is.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @shop/web lint && pnpm --filter @shop/web typecheck && pnpm --filter @shop/web test`
Expected: all green (the existing `nav-links` tests must still pass).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/cart/components apps/web/src/features/settings
git add -p "apps/web/src/app/[locale]/_components/navbar.tsx"   # only your hunks, not the xl:grid ones
git commit -m "feat(web): morph the cart and settings buttons into panels"
```

---

### Task 4: e2e and visual check

**Files:**

- Create: `e2e/tests/morph-popover.spec.ts`

**Interfaces:**

- Consumes: the running stack from `compose.e2e.yaml` (same as `e2e/tests/navbar.spec.ts`), trigger names `Language and currency` and `/^Cart/`.

- [ ] **Step 1: Write the e2e tests**

Create `e2e/tests/morph-popover.spec.ts`:

```ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.describe('desktop', () => {
  test.use({viewport: {width: 1600, height: 900}})

  test('settings pill grows into a panel, Escape shrinks it back to focus', async ({page}) => {
    await page.goto(`${WEB}/`)
    const trigger = page.getByRole('button', {name: 'Language and currency'})
    await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')
    await trigger.click()

    const dialog = page.getByRole('dialog', {name: 'Language and currency'})
    // Sampled right after the click: a morph is still growing, a pop-in would already be full size.
    const early = (await dialog.boundingBox())?.width ?? 0
    await page.waitForTimeout(700)
    const settled = (await dialog.boundingBox())?.width ?? 0
    expect(early).toBeLessThan(settled)
    await expect(dialog).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('opening the cart closes the settings panel', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: 'Language and currency'}).click()
    await expect(page.getByRole('dialog', {name: 'Language and currency'})).toBeVisible()
    await page.getByRole('button', {name: /^Cart/}).click()
    await expect(page.getByRole('dialog', {name: 'Your cart'})).toBeVisible()
    await expect(page.getByRole('dialog', {name: 'Language and currency'})).toHaveCount(0)
  })

  test('choosing a currency updates the trigger', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: 'Language and currency'}).click()
    await page.getByRole('radio', {name: /PLN/}).click()
    await expect(page.getByRole('button', {name: 'Language and currency'})).toContainText('zł')
  })
})

test.describe('phone', () => {
  test.use({viewport: {width: 375, height: 800}})

  test('cart panel stays inside the viewport', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: /^Cart/}).click()
    const dialog = page.getByRole('dialog', {name: 'Your cart'})
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(700)
    const box = await dialog.boundingBox()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)
  })
})
```

- [ ] **Step 2: Run the e2e suite**

Run the same way `navbar.spec.ts` is run (see `e2e/package.json` scripts and `compose.e2e.yaml`), for example: `pnpm --filter @shop/e2e test -- morph-popover`
Expected: PASS. If "early < settled" is flaky on a slow machine, keep it (it pins that the box morphs) but tighten by reading the width inside the click handler's microtask: `await trigger.click({noWaitAfter: true})`. If the phone test fails on the right edge, the cart panel width `3.75rem` offset in `cart-menu.tsx` is wrong for the real navbar padding; measure the burger button + gaps and correct it.

- [ ] **Step 3: Look at it (cannot be asserted)**

Run `pnpm dev` (web on :3000) and check by eye, at 1600px and 375px:

1. Settings pill: the box grows from the pill into the card with no corner jump; text blurs in after the box starts moving; closing shrinks back into the pill, and the "EN · €" text fades back in.
2. Cart circle: same, the white circle becomes the dark card (colors fade over ~300ms, no flash).
3. Navbar neighbours do not shift while the panel is open (the ghost holds the space).
4. Scroll the page so the navbar becomes the floating pill, then open a panel: no jump.
5. macOS "Reduce motion" on: panels appear without the box morph and still open/close.

- [ ] **Step 4: Full gate and commit**

Run from repo root: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green. Fix formatting with `pnpm format` if needed.

```bash
git add e2e/tests/morph-popover.spec.ts
git commit -m "test(e2e): cover MorphPopover morph, dismiss and phone viewport"
```

---

## Self-Review

- **Coverage:** reusable container transform (Task 1), language/currency button (Task 2), cart (Task 3), real-browser proof (Task 4). Reference frames drive the content blur and the pill→card growth.
- **Placeholders:** none; every code step has the full code.
- **Type consistency:** `MorphPopover` props (`triggerLabel`, `panelLabel`, `closeLabel`, `trigger`, `triggerClassName`, `panelClassName`, `anchor`, `children(close)`) are used identically in Tasks 2 and 3; `anchor` values `'top-end' | 'bottom-end'` match the navbar wiring; message key `nav.closePanel` is added in Task 2 and used in Tasks 2 and 3.
- **Known judgement call:** the panel is an anchored, non-modal `role="dialog"` (no backdrop scrim), matching the reference frames. If a scrim with scroll lock is wanted later, it is one more element in `MorphPopover`, and both users get it.
