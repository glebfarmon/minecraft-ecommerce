# Reusable Modal with Stacking Implementation Plan

> **Scope change (agreed in chat):** no URL mirroring. Task 3 (`useUrlModal`) was dropped; the catalog opens the product modal from plain `useState` and closing just flips `open`. Review Focus item 6 and the Back-button steps of Task 5 no longer apply.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One reusable `Modal` with enter/exit animation and a stacking hierarchy (a modal can open inside a modal, and every close affordance closes only the top one), then move the product modal onto it and make it open reliably on every URL and locale.

**Architecture:** `Modal` is a controlled component (`open` + `onClose`) built on a native `<dialog>` opened with `showModal()`, so the browser supplies the top layer, focus trap, inert background and "Escape closes only the topmost dialog". The dialog is a transparent full-viewport shell that owns its own animated backdrop and panel (the native `::backdrop` cannot be animated). `AnimatePresence` keeps the dialog mounted until the exit animation ends. Nesting is expressed by React context: a `Modal` rendered inside another `Modal`'s children reads the parent's depth and tells it "I am open" so the parent dims and shrinks slightly. Page scroll is locked by a ref-counted hook so a nested modal closing does not unlock the page. Part B drops the Next.js intercepting route (`@modal`), which does not match under next-intl's `as-needed` prefix, and opens the product modal from client state, mirroring the URL with `history.pushState` the way the server switcher already does.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Motion 13 (`motion/react`), next-intl, Jest + Testing Library, Playwright.

**Spec:** No design doc. Sources: the request in chat; `apps/web/src/features/catalog/components/product-modal.tsx` (current dialog, behavior to preserve); `apps/web/src/components/morph-popover.tsx` (Motion conventions); `docs/adr/0004-frontend-structure.md` (placement rules); the finding in chat that route interception only works for `en` at `/`.

## Global Constraints

- Frontend layout per ADR 0004: domain-free code in `src/components/` and `src/hooks/` (must NOT import `features/`, `app/`); domain code in `src/features/<name>/`; no barrel files; tests next to the code.
- Motion is imported from `motion/react` and wrapped in `<MotionConfig reducedMotion="user">` (existing convention).
- Every user-visible string goes through next-intl; `messages/en.json` and `messages/pl.json` keep identical keys (`src/i18n/messages.test.ts`).
- Do not bump ESLint (9) or TypeScript (6). No non-null assertions (`!`), the lint rule forbids them.
- TDD; Conventional Commits; before the last commit run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` from the repo root. `pnpm format:check` currently also lists two `.impeccable/hook.cache.json` files that are not part of this work; ignore them or add them to `.prettierignore`.
- Shell note (zsh): quote paths containing `[locale]`.
- `MorphPopover` stays the rule for "button expands into a panel" (CLAUDE.md). `Modal` is for centered blocking dialogs and does not replace it.

## Review Focus

1. **Escape and backdrop click with two modals open** close only the top one; the parent stays open. Pinned by Task 2 nested tests.
2. **Close then reopen while the exit animation runs** must leave exactly one dialog, not zero or two. Pinned by a Task 2 test.
3. **Scroll lock with nesting:** closing the inner modal keeps the page locked; closing the last one unlocks it and removes the scrollbar padding. Pinned by Task 1.
4. **Focus returns** to the element that opened the modal after the exit animation, including for the nested one. Pinned by Task 2.
5. **Cmd/Ctrl/Shift/middle-click on a product card** must still open the product page in a new tab, not the modal. Pinned by Task 4.
6. **Browser Back with a modal open** closes it and restores the catalog URL; opening again pushes a fresh entry. Pinned by Task 3 and the e2e test in Task 5.

---

## File Structure

| File                                                                          | Responsibility                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `jest.setup.ts` (modify)                                                      | Polyfill `HTMLDialogElement.showModal/close` for jsdom                                    |
| `src/hooks/use-scroll-lock.ts` (new) + `.test.ts`                             | Ref-counted page scroll lock                                                              |
| `src/components/modal.tsx` (new) + `modal.test.tsx`                           | Generic animated, stackable dialog: shell, backdrop, panel, close button, depth context   |
| `src/hooks/use-url-modal.ts` (new) + `.test.ts`                               | Open/close state mirrored to the URL with `pushState`, closes on Back                     |
| `src/features/catalog/components/product-modal.tsx` (modify)                  | Thin user of `Modal` around `ProductDetail`; takes `open`/`onClose` instead of the router |
| `src/features/catalog/components/product-card.tsx` (modify) + test            | Plain left click calls `onOpen`; modified clicks keep native link behavior                |
| `src/features/catalog/components/catalog.tsx` (modify)                        | Owns the product modal via `useUrlModal`                                                  |
| `src/app/[locale]/@modal/**`, `src/app/[locale]/layout.tsx` (delete / modify) | Remove the intercepting route and the `modal` slot                                        |
| `messages/en.json`, `messages/pl.json` (modify)                               | No new keys: reuses `product.close`                                                       |
| `e2e/tests/product-modal.spec.ts` (new)                                       | Real-browser open/close/Back on `/`, `/pl`, `/anarchy`                                    |
| `CLAUDE.md` (modify)                                                          | One rule line: dialogs use `Modal`                                                        |

All paths under `apps/web/` except `e2e/`, `CLAUDE.md` and `docs/`.

---

## Part A: the reusable modal

### Task 1: jsdom dialog polyfill and `useScrollLock`

**Files:**

- Modify: `apps/web/jest.setup.ts`
- Create: `apps/web/src/hooks/use-scroll-lock.ts`
- Test: `apps/web/src/hooks/use-scroll-lock.test.ts`

**Interfaces:**

- Produces: `useScrollLock(active: boolean): void`. While at least one caller is active, `document.documentElement` has `overflow: hidden` and a `padding-right` equal to the scrollbar width; the last caller to deactivate restores both to `''`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/hooks/use-scroll-lock.test.ts
import {renderHook} from '@testing-library/react'

import {useScrollLock} from './use-scroll-lock'

const root = () => document.documentElement

describe('useScrollLock', () => {
  it('locks while active and restores when inactive', () => {
    const {rerender} = renderHook(({active}) => useScrollLock(active), {
      initialProps: {active: true}
    })
    expect(root().style.overflow).toBe('hidden')
    rerender({active: false})
    expect(root().style.overflow).toBe('')
  })

  it('stays locked until the last of several callers releases', () => {
    const outer = renderHook(() => useScrollLock(true))
    const inner = renderHook(() => useScrollLock(true))
    inner.unmount()
    expect(root().style.overflow).toBe('hidden')
    outer.unmount()
    expect(root().style.overflow).toBe('')
    expect(root().style.paddingRight).toBe('')
  })

  it('compensates for the scrollbar width so the page does not shift', () => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1015})
    Object.defineProperty(root(), 'clientWidth', {configurable: true, value: 1000})
    const {unmount} = renderHook(() => useScrollLock(true))
    expect(root().style.paddingRight).toBe('15px')
    unmount()
    expect(root().style.paddingRight).toBe('')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm jest src/hooks/use-scroll-lock.test.ts`
Expected: FAIL with "Cannot find module './use-scroll-lock'".

- [ ] **Step 3: Write the hook and the jsdom polyfill**

```ts
// apps/web/src/hooks/use-scroll-lock.ts
'use client'

import {useEffect} from 'react'

let locks = 0

/** Freezes page scroll while any modal is open; the counter keeps a closing nested modal from unlocking the page. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    if (locks++ === 0) {
      const gap = window.innerWidth - root.clientWidth
      root.style.overflow = 'hidden'
      root.style.paddingRight = gap > 0 ? `${gap}px` : ''
    }
    return () => {
      if (--locks === 0) {
        root.style.overflow = ''
        root.style.paddingRight = ''
      }
    }
  }, [active])
}
```

Append to `apps/web/jest.setup.ts`:

```ts
// jsdom does not implement modal dialogs; model just the `open` attribute and the `close` event.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && pnpm jest src/hooks/use-scroll-lock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/jest.setup.ts apps/web/src/hooks/use-scroll-lock.ts apps/web/src/hooks/use-scroll-lock.test.ts
git commit -m "feat(web): add ref-counted scroll lock and jsdom dialog polyfill"
```

---

### Task 2: `Modal` with animation and stacking

**Files:**

- Create: `apps/web/src/components/modal.tsx`
- Test: `apps/web/src/components/modal.test.tsx`

**Interfaces:**

- Consumes: `useScrollLock(active: boolean)` from Task 1.
- Produces:

```ts
type ModalProps = {
  open: boolean
  onClose: () => void
  closeLabel: string // aria-label of the built-in X button
  labelledBy?: string // id of the heading inside children
  label?: string // fallback aria-label when there is no heading
  className?: string // extra classes for the panel, e.g. 'max-w-4xl p-4'
  style?: CSSProperties // set on the dialog, so CSS variables (accent) reach the panel
  children: ReactNode
}
export function Modal(props: ModalProps): JSX.Element
```

Behavior contract: controlled; `onClose` is called for Escape (the `cancel` event, default prevented), backdrop click, and the X button; the component never closes itself. A `Modal` rendered inside another `Modal`'s `children` is a child layer: it gets a lighter backdrop, and while it is open the parent panel carries `data-covered="true"`.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/modal.test.tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {useState} from 'react'

import {Modal} from './modal'

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

const cancel = (el: HTMLElement) => fireEvent(el, new Event('cancel', {cancelable: true}))

function Basic({onClose = jest.fn(), open = true}: {onClose?: () => void; open?: boolean}) {
  return (
    <Modal open={open} onClose={onClose} closeLabel="Close" label="Outer">
      <button type="button">inside</button>
    </Modal>
  )
}

describe('Modal', () => {
  it('renders an open dialog only while open', async () => {
    const {rerender} = render(<Basic open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Basic open />)
    expect(screen.getByRole('dialog', {name: 'Outer'})).toBeInTheDocument()
    rerender(<Basic open={false} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('asks to close on Escape, backdrop click and the X button, but not on inner clicks', () => {
    const onClose = jest.fn()
    render(<Basic onClose={onClose} />)
    cancel(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', {name: 'Close'}))
    expect(onClose).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', {name: 'inside'}))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('never closes itself: the dialog stays until the parent flips `open`', () => {
    render(<Basic />)
    cancel(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the opener after closing', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          <Modal open={open} onClose={() => setOpen(false)} closeLabel="Close" label="M">
            body
          </Modal>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', {name: 'opener'})
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(await screen.findByRole('button', {name: 'Close'}))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('survives close then reopen mid-exit with exactly one dialog', async () => {
    const {rerender} = render(<Basic open />)
    rerender(<Basic open={false} />)
    rerender(<Basic open />)
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
  })

  it('locks page scroll while open and releases it after the exit', async () => {
    const {rerender} = render(<Basic open />)
    expect(document.documentElement.style.overflow).toBe('hidden')
    rerender(<Basic open={false} />)
    await waitFor(() => expect(document.documentElement.style.overflow).toBe(''))
  })
})

describe('Modal stacking', () => {
  function Stack({
    outerClose,
    innerClose,
    innerOpen = true
  }: {
    outerClose: () => void
    innerClose: () => void
    innerOpen?: boolean
  }) {
    return (
      <Modal open onClose={outerClose} closeLabel="Close outer" label="Outer">
        <p>outer body</p>
        <Modal open={innerOpen} onClose={innerClose} closeLabel="Close inner" label="Inner">
          <p>inner body</p>
        </Modal>
      </Modal>
    )
  }

  it('Escape closes only the top modal', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    render(<Stack outerClose={outer} innerClose={inner} />)
    cancel(screen.getByRole('dialog', {name: 'Inner'}))
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it('a backdrop click closes only its own modal', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    render(<Stack outerClose={outer} innerClose={inner} />)
    const [outerBackdrop, innerBackdrop] = screen.getAllByTestId('modal-backdrop')
    fireEvent.click(innerBackdrop as HTMLElement)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    fireEvent.click(outerBackdrop as HTMLElement)
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('closing the inner modal leaves the outer one open and uncovered', async () => {
    const {rerender} = render(<Stack outerClose={jest.fn()} innerClose={jest.fn()} />)
    const outerPanel = () =>
      screen.getByRole('dialog', {name: 'Outer'}).querySelector('[data-covered]')
    expect(outerPanel()).toHaveAttribute('data-covered', 'true')
    rerender(<Stack outerClose={jest.fn()} innerClose={jest.fn()} innerOpen={false} />)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: 'Inner'})).not.toBeInTheDocument()
    )
    expect(screen.getByRole('dialog', {name: 'Outer'})).toBeInTheDocument()
    expect(outerPanel()).toHaveAttribute('data-covered', 'false')
  })

  it('keeps the page locked until the outer modal closes too', async () => {
    const {rerender} = render(<Stack outerClose={jest.fn()} innerClose={jest.fn()} />)
    rerender(<Stack outerClose={jest.fn()} innerClose={jest.fn()} innerOpen={false} />)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: 'Inner'})).not.toBeInTheDocument()
    )
    expect(document.documentElement.style.overflow).toBe('hidden')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/web && pnpm jest src/components/modal.test.tsx`
Expected: FAIL with "Cannot find module './modal'".

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/components/modal.tsx
'use client'

import {useScrollLock} from '@/hooks/use-scroll-lock'
import {X} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion, useIsPresent} from 'motion/react'
import type {CSSProperties, ReactNode} from 'react'
import {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

const BACKDROP = {hidden: {opacity: 0}, shown: {opacity: 1}}
const PANEL = {
  hidden: {opacity: 0, y: 24, scale: 0.98},
  shown: {opacity: 1, y: 0, scale: 1}
}

type Layer = {depth: number; cover: () => () => void}
/** Set by each open modal so a modal rendered in its children knows its depth and can dim it. */
const LayerContext = createContext<Layer | null>(null)

type Props = {
  open: boolean
  onClose: () => void
  closeLabel: string
  labelledBy?: string
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Controlled, stackable dialog. The native `<dialog>` (opened with `showModal`) supplies the top
 * layer, focus trap and "Escape closes only the topmost". It is a transparent full-viewport shell:
 * the backdrop and panel are our own so they can animate in and out. A Modal inside another
 * Modal's children is a child layer; it lightens its backdrop and marks the parent as covered.
 */
export function Modal({open, ...props}: Props) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <ModalDialog key="dialog" {...props} />}</AnimatePresence>
    </MotionConfig>
  )
}

function ModalDialog({
  onClose,
  closeLabel,
  labelledBy,
  label,
  className = '',
  style,
  children
}: Omit<Props, 'open'>) {
  const parent = useContext(LayerContext)
  const depth = parent ? parent.depth + 1 : 0
  const [covers, setCovers] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const present = useIsPresent()
  useScrollLock(true)

  const layer = useMemo<Layer>(
    () => ({
      depth,
      cover: () => {
        setCovers(n => n + 1)
        return () => {
          setCovers(n => n - 1)
        }
      }
    }),
    [depth]
  )

  useEffect(() => parent?.cover(), [parent])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const opener = document.activeElement
    if (!el.open) el.showModal()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  const covered = covers > 0

  return (
    <LayerContext value={layer}>
      <motion.dialog
        ref={dialog}
        initial="hidden"
        animate="shown"
        exit="hidden"
        transition={{duration: 0.3, ease: EASE}}
        inert={!present}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        onCancel={e => {
          e.preventDefault()
          onClose()
        }}
        style={style}
        className="text-fg fixed inset-0 m-0 grid h-full max-h-none w-full max-w-none place-items-center bg-transparent p-[var(--gutter)] backdrop:bg-transparent">
        <motion.div
          variants={BACKDROP}
          data-testid="modal-backdrop"
          aria-hidden="true"
          onClick={onClose}
          className={`absolute inset-0 ${depth === 0 ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/40'}`}
        />
        <motion.div
          variants={PANEL}
          className="relative z-10 flex max-h-full w-full justify-center">
          <motion.div
            data-covered={covered}
            initial={false}
            animate={
              covered
                ? {scale: 0.97, filter: 'brightness(0.6)'}
                : {scale: 1, filter: 'brightness(1)'}
            }
            transition={{duration: 0.25, ease: EASE}}
            className={`border-border bg-surface relative max-h-full w-full overflow-y-auto rounded-[var(--radius-card)] border ${className}`}>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="bg-ink/80 text-fg hover:bg-ink absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full">
              <X className="size-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      </motion.dialog>
    </LayerContext>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && pnpm jest src/components/modal.test.tsx`
Expected: PASS. If the exit tests hang (motion never finishes in jsdom despite `skipAnimations`), set the same flag in `jest.setup.ts` instead of per-file and re-run; do not weaken the assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modal.tsx apps/web/src/components/modal.test.tsx
git commit -m "feat(web): add reusable stackable Modal with enter/exit animation"
```

---

## Part B: product modal on `Modal`, opened from state

### Task 3: `useUrlModal`

**Files:**

- Create: `apps/web/src/hooks/use-url-modal.ts`
- Test: `apps/web/src/hooks/use-url-modal.test.ts`

**Interfaces:**

- Produces:

```ts
export function useUrlModal<T>(urlFor: (value: T) => string): {
  value: T | null // last opened value; kept after close so the exit animation still has content
  open: boolean
  show: (value: T) => void // pushState(urlFor(value)) and open
  close: () => void // history.back() when we pushed an entry, so the URL returns to where it was
}
```

Browser Back or Forward (`popstate`) closes the modal. Forward does not reopen it.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/hooks/use-url-modal.test.ts
import {act, renderHook} from '@testing-library/react'

import {useUrlModal} from './use-url-modal'

const urlFor = (n: number) => `/item/${n}`

describe('useUrlModal', () => {
  let pushState: jest.SpyInstance
  let back: jest.SpyInstance

  beforeEach(() => {
    pushState = jest.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined)
  })
  afterEach(() => {
    pushState.mockRestore()
    back.mockRestore()
  })

  it('opens with a pushed URL and keeps the value', () => {
    const {result} = renderHook(() => useUrlModal(urlFor))
    expect(result.current.open).toBe(false)
    act(() => result.current.show(7))
    expect(pushState).toHaveBeenCalledWith(null, '', '/item/7')
    expect(result.current).toMatchObject({value: 7, open: true})
  })

  it('close goes back in history instead of pushing another entry', () => {
    const {result} = renderHook(() => useUrlModal(urlFor))
    act(() => result.current.show(7))
    act(() => result.current.close())
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('closes on popstate and keeps the last value for the exit animation', () => {
    const {result} = renderHook(() => useUrlModal(urlFor))
    act(() => result.current.show(7))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current).toMatchObject({value: 7, open: false})
  })

  it('a second open after Back pushes a fresh entry', () => {
    const {result} = renderHook(() => useUrlModal(urlFor))
    act(() => result.current.show(1))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    act(() => result.current.show(2))
    expect(pushState).toHaveBeenCalledTimes(2)
    expect(result.current).toMatchObject({value: 2, open: true})
  })

  it('close without an open modal does nothing', () => {
    const {result} = renderHook(() => useUrlModal(urlFor))
    act(() => result.current.close())
    expect(back).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm jest src/hooks/use-url-modal.test.ts`
Expected: FAIL with "Cannot find module './use-url-modal'".

- [ ] **Step 3: Write the hook**

```ts
// apps/web/src/hooks/use-url-modal.ts
'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

/**
 * Modal state mirrored to the address bar. Opening pushes a history entry, closing steps back, so
 * the browser Back button and the close button are the same thing. Next patches `pushState`, so
 * the router stays in sync (the catalog's server switcher relies on the same behavior).
 */
export function useUrlModal<T>(urlFor: (value: T) => string) {
  const [state, setState] = useState<{value: T | null; open: boolean}>({value: null, open: false})
  const pushed = useRef(false)

  const show = useCallback(
    (value: T) => {
      window.history.pushState(null, '', urlFor(value))
      pushed.current = true
      setState({value, open: true})
    },
    [urlFor]
  )

  const close = useCallback(() => {
    if (!pushed.current) return
    window.history.back()
  }, [])

  useEffect(() => {
    const onPop = () => {
      pushed.current = false
      setState(s => ({...s, open: false}))
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  return {value: state.value, open: state.open, show, close}
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && pnpm jest src/hooks/use-url-modal.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-url-modal.ts apps/web/src/hooks/use-url-modal.test.ts
git commit -m "feat(web): add useUrlModal (history-backed modal state)"
```

---

### Task 4: Product modal, card and catalog wiring; remove the intercepting route

**Files:**

- Modify: `apps/web/src/features/catalog/components/product-modal.tsx`
- Modify: `apps/web/src/features/catalog/components/product-card.tsx`
- Modify: `apps/web/src/features/catalog/components/product-card.test.tsx`
- Modify: `apps/web/src/features/catalog/components/catalog.tsx`
- Delete: `apps/web/src/app/[locale]/@modal/` (whole folder)
- Modify: `apps/web/src/app/[locale]/layout.tsx` (drop the `modal` prop and the `{modal}` render)

**Interfaces:**

- Consumes: `Modal`, `useUrlModal`, `getPathname` from `@/i18n/navigation`.
- Produces: `ProductModal({product, server, open, onClose})`; `ProductCard({product, onOpen})` where `onOpen: (product: Product) => void`.

- [ ] **Step 1: Write the failing card tests**

Append to `product-card.test.tsx` and pass `onOpen` in the existing renders (`<ProductCard product={product} onOpen={jest.fn()} />`):

```tsx
import {fireEvent} from '@testing-library/react'

describe('ProductCard opening', () => {
  it('a plain left click opens the modal instead of navigating', () => {
    const onOpen = jest.fn()
    render(<ProductCard product={product} onOpen={onOpen} />)
    const link = screen.getByRole('link')
    const notPrevented = fireEvent.click(link)
    expect(onOpen).toHaveBeenCalledWith(product)
    expect(notPrevented).toBe(false)
  })

  it.each([{metaKey: true}, {ctrlKey: true}, {shiftKey: true}, {button: 1}])(
    'a modified click %o keeps the native link behavior',
    init => {
      const onOpen = jest.fn()
      render(<ProductCard product={product} onOpen={onOpen} />)
      fireEvent.click(screen.getByRole('link'), init)
      expect(onOpen).not.toHaveBeenCalled()
    }
  )
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/web && pnpm jest src/features/catalog/components/product-card.test.tsx`
Expected: FAIL (`onOpen` is never called).

- [ ] **Step 3: Implement**

`product-card.tsx`: add the prop and the click handler on the existing `Link`:

```tsx
export function ProductCard({
  product,
  onOpen
}: {
  product: Product
  onOpen: (product: Product) => void
}) {
  // …unchanged hooks…
  <Link
    href={`/${product.server}/${product.slug}`}
    scroll={false}
    onClick={e => {
      // Modified clicks keep opening the product page in a new tab or window.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      onOpen(product)
    }}
    className="…unchanged…">
```

`product-modal.tsx`:

```tsx
'use client'

import {Modal} from '@/components/modal'
import {ProductDetail} from '@/features/catalog/components/product-detail'
import type {Product, Server} from '@/lib/catalog'
import {useTranslations} from 'next-intl'
import {useId} from 'react'
import type {CSSProperties} from 'react'

export function ProductModal({
  product,
  server,
  open,
  onClose
}: {
  product: Product
  server: Server
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations('product')
  const titleId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('close')}
      labelledBy={titleId}
      style={{'--accent': server.accent, '--on-accent': server.onAccent} as CSSProperties}
      className="max-w-4xl p-4 md:p-6">
      <ProductDetail product={product} server={server} titleId={titleId} />
    </Modal>
  )
}
```

`catalog.tsx`: inside `Catalog`, next to the existing `getPathname` usage for the server switcher:

```tsx
const productModal = useUrlModal<Product>(p =>
  getPathname({locale, href: `/${p.server}/${p.slug}`})
)
const modalServer = productModal.value ? findServer(productModal.value.server) : undefined
// …in the grid: <ProductCard product={product} onOpen={productModal.show} />
// …after the grid, inside the section:
{
  productModal.value && modalServer && (
    <ProductModal
      product={productModal.value}
      server={modalServer}
      open={productModal.open}
      onClose={productModal.close}
    />
  )
}
```

Add the imports (`useUrlModal`, `ProductModal`, `findServer`, `Product`). `useUrlModal`'s `urlFor` must be stable: define it with `useCallback([locale])` in `Catalog` if the file's lint rules (`react-hooks/exhaustive-deps`) complain.

Then remove the interception:

```bash
git rm -r "apps/web/src/app/[locale]/@modal"
```

and in `layout.tsx` delete `modal` from the destructured props, the prop type, and the `{modal}` node. `src/app/[locale]/[server]/[product]/page.tsx` stays: it is the full page for direct visits.

- [ ] **Step 4: Run the whole web suite**

Run: `cd apps/web && pnpm jest`
Expected: PASS. `catalog.test.tsx` mocks `ProductCard`, so it needs no change; if it renders the real `ProductModal` anywhere, mock `@/components/modal` there.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): open the product modal from state, drop the intercepting route"
```

---

### Task 5: End-to-end check, docs rule, final gates

**Files:**

- Create: `e2e/tests/product-modal.spec.ts` (match the config and `baseURL` of the existing specs in `e2e/tests/`)
- Modify: `CLAUDE.md` (add the rule line below under "Architecture rules")

- [ ] **Step 1: Write the e2e test**

```ts
import {expect, test} from '@playwright/test'

for (const start of ['/', '/pl', '/anarchy']) {
  test(`product card opens a modal at ${start}; Escape and Back close it`, async ({page}) => {
    await page.goto(start)
    await page.getByRole('link', {name: /vip/i}).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page).not.toHaveURL(new RegExp(`${start === '/' ? '^$' : start}$`))

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`${start === '/' ? '/$' : `${start}$`}`))

    await page.getByRole('link', {name: /vip/i}).first().click()
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(dialog).toBeHidden()
  })
}
```

(Adjust the product name regex to a product that exists on each server; the executor picks one from `src/lib/catalog.ts`.)

- [ ] **Step 2: Run it**

Run: from the repo root, the e2e command used by the existing specs (see `e2e/package.json`).
Expected: PASS on all three starting URLs.

- [ ] **Step 3: Add the rule to `CLAUDE.md`**

Under "Architecture rules", after the `MorphPopover` bullet:

```md
- Centered blocking dialogs use `Modal` (`apps/web/src/components/modal.tsx`): controlled `open`/`onClose`, animated, stackable (a `Modal` inside another `Modal`'s children is a child layer; Escape and backdrop close only the top one). Do not hand-roll `<dialog>`. Plan: `docs/superpowers/plans/2026-10-02-modal-stack.md`.
```

- [ ] **Step 4: Run the full gate**

Run (repo root): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && graphify update .`
Expected: all green apart from the two `.impeccable` cache files noted in Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/product-modal.spec.ts CLAUDE.md
git commit -m "test(web): e2e product modal; docs: document Modal rule"
```

---

## Self-review

- **Coverage:** animation in/out (Task 2 variants + `AnimatePresence`), hierarchy and "close one" (Task 2 context + stacking tests), reusable and domain-free (`components/modal.tsx`, no `features/` import), plus the earlier decision to open the product modal from state (Tasks 3 and 4). Review Focus items 1 to 6 each map to a named test.
- **Placeholders:** none left; the only executor judgment calls are the e2e product regex (depends on catalog data), the `useCallback` for `urlFor` if lint asks, and the `skipAnimations` fallback, each with a stated rule.
- **Types:** `ModalProps` fields (`open`, `onClose`, `closeLabel`, `labelledBy`, `label`, `className`, `style`) match every use in Tasks 2 and 4; `useUrlModal` returns `{value, open, show, close}` and Task 4 uses exactly those names; `ProductCard` prop is `onOpen` everywhere.
- **Not in this plan (on purpose):** an actual nested modal in the shop UI. The stack is proven by unit tests with generic children. A natural first user is an 18+ confirmation when adding an adult product, but that is a product decision, so it is a separate request.
