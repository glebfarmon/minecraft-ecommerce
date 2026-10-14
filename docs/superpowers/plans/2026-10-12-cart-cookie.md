# Cart Cookie and Page-Scoped Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The cart lives in a `cart` cookie and is resolved on the server, so the layout sends the client only servers and the cart's own products; the full product list reaches only the catalog pages.

**Architecture:** A pure cookie codec (`cart-cookie.ts`) and a pure resolver (`resolve-cart.ts`) turn the `cart`/`currency` cookies plus the cached catalog into `{lines, currency}`; the layout passes them to `ShopProvider`, which keeps each line with its product and writes the cookie only when the player changes the cart. `CatalogProvider` shrinks to servers; `<Catalog>` takes `products` as a prop from the home and `[server]` pages.

**Tech Stack:** Next.js 16 App Router (`cookies()` from `next/headers`, async), React 19, next-intl 4, Jest + Testing Library (jsdom), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-12-cart-cookie-design.md`

## Global Constraints

- Business logic only in `apps/api`; Next has no route handlers. This plan changes `apps/web` only; the API and `@shop/shared` contract do not change.
- Cookie `cart`: `path=/`, `max-age` 30 days, `SameSite=Lax`, not `HttpOnly`. Value `server:slug:qty` lines joined by `|`.
- `MAX_QTY = 99` (unchanged), `MAX_LINES = 30`.
- server and slug must match `^[a-z0-9-]+$`.
- The cart cookie is written only in `add`, `decrement`, `remove` — never on mount.
- No migration: `localStorage` (`shop:v1`) and the legacy currency stored there are no longer read; delete that code.
- Imports flow shared → features → app; no barrels (ADR 0004). Tweakable constants in `config/` (ADR 0005).
- TDD: failing test first. Before each commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits; end each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query` before grepping; run `graphify update .` after editing code.

## Review Focus

1. API down on a request: the layout renders an empty cart; the stored cookie must survive (no write on mount). Pinned in Task 3 ("does not write the cookie on mount").
2. A hand-edited cookie with `;`-free garbage, huge quantities, duplicates or 100 lines must never 500 and must stay under 4 KB once rewritten. Pinned in Task 1.
3. Locale switch must show the cart from the server for the new locale, not stale client state. Pinned by `key={locale}` in Task 3 and the PL e2e in Task 5.
4. Strict Mode double effects must not write the cookie on mount. Pinned in Task 3.
5. `/rules` HTML must not contain products outside the cart. Pinned by e2e in Task 5.

## File Structure

| File (under `apps/web/src`)               | Responsibility                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `config/cart.ts`                          | `CART_COOKIE`, `CART_COOKIE_MAX_AGE`, `MAX_LINES`; `CART_STORAGE_KEY` removed |
| `features/cart/types.ts` (new)            | `CartLine` (cookie line) and `CartItem` (line with its product)               |
| `features/cart/lib/cart-cookie.ts` (new)  | `parseCart`, `serializeCart`, `writeCartCookie`                               |
| `features/cart/lib/resolve-cart.ts` (new) | pure: cookies + products → `{lines, currency}`                                |
| `features/cart/api/load-cart.ts` (new)    | server: reads `cookies()`, calls `resolveCart`                                |
| `features/cart/shop-provider.tsx`         | state from props; cookie writes in actions                                    |
| `features/catalog/catalog-provider.tsx`   | servers only                                                                  |
| `features/catalog/components/catalog.tsx` | `products` prop                                                               |
| `app/[locale]/layout.tsx`                 | wires `loadCart`, `servers`, `key={locale}`                                   |
| `app/[locale]/_components/home-view.tsx`  | passes `catalog.products` to `<Catalog>`                                      |
| `features/catalog/test-catalog.tsx`       | `renderWithCatalog` gives the provider servers                                |
| `e2e/tests/cart.spec.ts` (new)            | server-rendered cart, no foreign products on `/rules`, locale switch          |

---

### Task 1: Cart cookie codec

**Files:**

- Create: `apps/web/src/features/cart/types.ts`
- Create: `apps/web/src/features/cart/lib/cart-cookie.ts`
- Modify: `apps/web/src/config/cart.ts`
- Test: `apps/web/src/features/cart/lib/cart-cookie.test.ts`

**Interfaces:**

- Consumes: `MAX_QTY` from `@/config/cart`; `CatalogProduct` from `@shop/shared/catalog`.
- Produces:
  - `type CartLine = {server: string; slug: string; qty: number}` and `type CartItem = {product: CatalogProduct; qty: number}` in `@/features/cart/types`.
  - `CART_COOKIE = 'cart'`, `CART_COOKIE_MAX_AGE` (seconds), `MAX_LINES = 30` in `@/config/cart`.
  - `parseCart(raw: string | undefined): CartLine[]`, `serializeCart(lines: readonly CartLine[]): string`, `writeCartCookie(lines: readonly CartLine[]): void` in `@/features/cart/lib/cart-cookie`.

- [ ] **Step 1: Add the types file**

`apps/web/src/features/cart/types.ts`:

```ts
import type {CatalogProduct} from '@shop/shared/catalog'

/** One line as stored in the `cart` cookie. */
export type CartLine = {server: string; slug: string; qty: number}

/** A cart line together with the product it points at. */
export type CartItem = {product: CatalogProduct; qty: number}
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/features/cart/lib/cart-cookie.test.ts`:

```ts
import {CART_COOKIE, MAX_LINES} from '@/config/cart'

import {parseCart, serializeCart, writeCartCookie} from './cart-cookie'

describe('cart cookie', () => {
  it('round-trips lines', () => {
    const lines = [
      {server: 'survival', slug: 'vip', qty: 1},
      {server: 'anarchy', slug: 'coins-1000', qty: 3}
    ]
    expect(serializeCart(lines)).toBe('survival:vip:1|anarchy:coins-1000:3')
    expect(parseCart(serializeCart(lines))).toEqual(lines)
  })

  it('is empty for a missing or empty cookie', () => {
    expect(parseCart(undefined)).toEqual([])
    expect(parseCart('')).toEqual([])
  })

  it('keeps only well-formed lines', () => {
    const raw = [
      'garbage',
      'a:b',
      'survival:VIP:1',
      'survival:vip:x',
      ':vip:1',
      'survival:vip:1:extra',
      'survival:vip:-1',
      'survival:vip:1.5',
      'survival:vip:0',
      'anarchy:pvp-kit:2'
    ].join('|')
    expect(parseCart(raw)).toEqual([{server: 'anarchy', slug: 'pvp-kit', qty: 2}])
  })

  it('clamps quantities to 99 and merges duplicates', () => {
    expect(parseCart('survival:vip:5000')).toEqual([{server: 'survival', slug: 'vip', qty: 99}])
    expect(parseCart('survival:vip:60|survival:vip:60')).toEqual([
      {server: 'survival', slug: 'vip', qty: 99}
    ])
  })

  it(`keeps at most ${String(MAX_LINES)} lines`, () => {
    const raw = Array.from({length: MAX_LINES + 1}, (_, i) => `survival:p${String(i)}:1`).join('|')
    const lines = parseCart(raw)
    expect(lines).toHaveLength(MAX_LINES)
    expect(lines.at(-1)?.slug).toBe(`p${String(MAX_LINES - 1)}`)
  })

  it('fits the maximum cart with long slugs into one 4 KB cookie', () => {
    const long = 'x'.repeat(40)
    const lines = Array.from({length: MAX_LINES}, (_, i) => ({
      server: long,
      slug: `${long.slice(2)}${String(i).padStart(2, '0')}`,
      qty: 99
    }))
    expect(`${CART_COOKIE}=${serializeCart(lines)}`.length).toBeLessThanOrEqual(4096)
  })

  it('writes the cookie for the whole site', () => {
    writeCartCookie([{server: 'survival', slug: 'vip', qty: 2}])
    expect(document.cookie).toContain('cart=survival:vip:2')
    document.cookie = 'cart=; path=/; max-age=0'
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/cart/lib/cart-cookie.test.ts`
Expected: FAIL — `Cannot find module './cart-cookie'` (and `CART_COOKIE`/`MAX_LINES` not exported).

- [ ] **Step 4: Add the constants**

In `apps/web/src/config/cart.ts` replace the line `export const CART_STORAGE_KEY = 'shop:v1'` with:

```ts
/** Distinct products in one cart; keeps the `cart` cookie well under 4 KB. */
export const MAX_LINES = 30

export const CART_COOKIE = 'cart'
export const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // seconds
```

(`CART_STORAGE_KEY` is still imported by `shop-provider.tsx` until Task 3; to keep this task compiling, leave `export const CART_STORAGE_KEY = 'shop:v1'` in place for now and delete it in Task 3.)

- [ ] **Step 5: Write the codec**

`apps/web/src/features/cart/lib/cart-cookie.ts`:

```ts
import {CART_COOKIE, CART_COOKIE_MAX_AGE, MAX_LINES, MAX_QTY} from '@/config/cart'
import type {CartLine} from '@/features/cart/types'

const SLUG = /^[a-z0-9-]+$/
const QTY = /^\d+$/

/**
 * `cart` cookie value → lines. The cookie is user-editable: keep well-formed lines only,
 * merge duplicates, clamp quantities to 1..MAX_QTY and keep the first MAX_LINES lines.
 */
export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return []
  const lines: CartLine[] = []
  for (const part of raw.split('|')) {
    const [server, slug, qtyText, ...rest] = part.split(':')
    if (rest.length > 0 || !server || !slug || !qtyText) continue
    if (!SLUG.test(server) || !SLUG.test(slug) || !QTY.test(qtyText)) continue
    const qty = Number(qtyText)
    if (qty < 1) continue
    const hit = lines.find(l => l.server === server && l.slug === slug)
    if (hit) hit.qty = Math.min(hit.qty + qty, MAX_QTY)
    else if (lines.length < MAX_LINES) lines.push({server, slug, qty: Math.min(qty, MAX_QTY)})
  }
  return lines
}

/** Lines → cookie value: `server:slug:qty` joined by `|` (RFC 6265 forbids `,` in a cookie value). */
export function serializeCart(lines: readonly CartLine[]): string {
  return lines.map(l => `${l.server}:${l.slug}:${String(l.qty)}`).join('|')
}

export function writeCartCookie(lines: readonly CartLine[]): void {
  document.cookie = `${CART_COOKIE}=${serializeCart(lines)}; path=/; max-age=${String(CART_COOKIE_MAX_AGE)}; SameSite=Lax`
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @shop/web exec jest src/features/cart/lib/cart-cookie.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/config/cart.ts apps/web/src/features/cart/types.ts apps/web/src/features/cart/lib/cart-cookie.ts apps/web/src/features/cart/lib/cart-cookie.test.ts
git commit -m "feat(web): cart cookie codec"
```

---

### Task 2: Resolve the cart on the server

**Files:**

- Create: `apps/web/src/features/cart/lib/resolve-cart.ts`
- Create: `apps/web/src/features/cart/api/load-cart.ts`
- Test: `apps/web/src/features/cart/lib/resolve-cart.test.ts`

**Interfaces:**

- Consumes: `parseCart` (Task 1), `CartItem` (Task 1), `CART_COOKIE`, `CURRENCY_COOKIE` from `@/config/cart`, `DEFAULT_CURRENCY`, `isCurrency`, `Currency` from `@/config/currencies`.
- Produces:
  - `type ResolvedCart = {lines: CartItem[]; currency: Currency}`
  - `resolveCart(rawCart: string | undefined, rawCurrency: string | undefined, products: readonly CatalogProduct[]): ResolvedCart` in `@/features/cart/lib/resolve-cart`.
  - `loadCart(catalog: CatalogResponse | null): Promise<ResolvedCart>` in `@/features/cart/api/load-cart` (server only; reads `cookies()`).

- [ ] **Step 1: Write the failing test**

`apps/web/src/features/cart/lib/resolve-cart.test.ts`:

```ts
import {TEST_CATALOG} from '@/features/catalog/test-catalog'

import {resolveCart} from './resolve-cart'

const {products} = TEST_CATALOG

describe('resolveCart', () => {
  it('pairs each cookie line with its product', () => {
    const {lines} = resolveCart('survival:vip:2|anarchy:pvp-kit:1', undefined, products)
    expect(lines.map(l => [l.product.name, l.qty])).toEqual([
      ['VIP', 2],
      ['PvP kit', 1]
    ])
  })

  it('drops lines whose product is not in the catalog (or is on another server)', () => {
    const {lines} = resolveCart(
      'survival:vip:1|survival:removed-rank:2|anarchy:vip:1',
      undefined,
      products
    )
    expect(lines.map(l => l.product.slug)).toEqual(['vip'])
  })

  it('has no lines without a catalog', () => {
    expect(resolveCart('survival:vip:1', undefined, []).lines).toEqual([])
  })

  it('takes the currency from its cookie, or the default', () => {
    expect(resolveCart(undefined, 'PLN', products).currency).toBe('PLN')
    expect(resolveCart(undefined, 'XXX', products).currency).toBe('EUR')
    expect(resolveCart(undefined, undefined, products).currency).toBe('EUR')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/cart/lib/resolve-cart.test.ts`
Expected: FAIL — `Cannot find module './resolve-cart'`.

- [ ] **Step 3: Write the resolver**

`apps/web/src/features/cart/lib/resolve-cart.ts`:

```ts
import {type Currency, DEFAULT_CURRENCY, isCurrency} from '@/config/currencies'
import {parseCart} from '@/features/cart/lib/cart-cookie'
import type {CartItem} from '@/features/cart/types'

import type {CatalogProduct} from '@shop/shared/catalog'

export type ResolvedCart = {lines: CartItem[]; currency: Currency}

/** Cookie values + the catalog → what `ShopProvider` starts with. Lines without a product are dropped. */
export function resolveCart(
  rawCart: string | undefined,
  rawCurrency: string | undefined,
  products: readonly CatalogProduct[]
): ResolvedCart {
  const lines = parseCart(rawCart).flatMap(line => {
    const product = products.find(p => p.server === line.server && p.slug === line.slug)
    return product ? [{product, qty: line.qty}] : []
  })
  return {lines, currency: isCurrency(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY}
}
```

- [ ] **Step 4: Write the server loader**

`apps/web/src/features/cart/api/load-cart.ts`:

```ts
import {CART_COOKIE, CURRENCY_COOKIE} from '@/config/cart'
import {type ResolvedCart, resolveCart} from '@/features/cart/lib/resolve-cart'
import {cookies} from 'next/headers'

import type {CatalogResponse} from '@shop/shared/catalog'

/** The visitor's cart and currency from their cookies, resolved against the (cached) catalog. */
export async function loadCart(catalog: CatalogResponse | null): Promise<ResolvedCart> {
  const store = await cookies()
  return resolveCart(
    store.get(CART_COOKIE)?.value,
    store.get(CURRENCY_COOKIE)?.value,
    catalog?.products ?? []
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @shop/web exec jest src/features/cart/lib/resolve-cart.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/features/cart/lib/resolve-cart.ts apps/web/src/features/cart/lib/resolve-cart.test.ts apps/web/src/features/cart/api/load-cart.ts
git commit -m "feat(web): resolve the cart from cookies on the server"
```

---

### Task 3: ShopProvider starts from the server and writes the cookie

**Files:**

- Modify: `apps/web/src/features/cart/shop-provider.tsx` (whole file)
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/config/cart.ts` (delete `CART_STORAGE_KEY`)
- Test: `apps/web/src/features/cart/shop-provider.test.tsx` (whole file)
- Modify (remove `localStorage.clear()` lines): `features/cart/components/cart-menu.test.tsx`, `features/checkout/components/checkout-modal.test.tsx`, `features/settings/components/settings-menu.test.tsx`, `features/catalog/components/catalog-add-to-cart.test.tsx`

**Interfaces:**

- Consumes: `writeCartCookie` (Task 1), `CartItem` (Task 1), `loadCart` (Task 2), `MAX_LINES`, `MAX_QTY`, `CURRENCY_COOKIE`, `CURRENCY_COOKIE_MAX_AGE`.
- Produces: `ShopProvider({initialLines?: CartItem[]; initialCurrency?: Currency; children})`. `useCart(): {lines: CartItem[]; count: number}`, `useCartActions()`, `useCurrency()` keep their current shapes. `ShopProvider` no longer calls `useCatalog()`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/features/cart/shop-provider.test.tsx` with:

```tsx
import {MAX_LINES} from '@/config/cart'
import {ShopProvider, useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {StrictMode} from 'react'
import {renderToString} from 'react-dom/server'

import type {CatalogProduct} from '@shop/shared/catalog'

const [first] = TEST_CATALOG.products
if (!first) throw new Error('catalog is empty')
const product: CatalogProduct = first

const clearCookies = () => {
  document.cookie = 'cart=; path=/; max-age=0'
  document.cookie = 'currency=; path=/; max-age=0'
}
beforeEach(clearCookies)
afterEach(clearCookies)

let cardRenders = 0
// Stands in for a ProductCard: reads the currency and the stable actions only.
function Card() {
  const {currency} = useCurrency()
  const {add} = useCartActions()
  cardRenders++
  return (
    <button
      type="button"
      onClick={() => {
        add(product)
      }}>
      add {currency}
    </button>
  )
}

function Cart() {
  const {count} = useCart()
  const {add, remove} = useCartActions()
  return (
    <>
      <p data-testid="count">{count}</p>
      <button
        type="button"
        onClick={() => {
          add(product)
        }}>
        add
      </button>
      <button
        type="button"
        onClick={() => {
          remove(product)
        }}>
        remove
      </button>
    </>
  )
}

describe('ShopProvider contexts', () => {
  beforeEach(() => {
    cardRenders = 0
  })

  it('does not re-render currency/actions consumers when the cart changes', () => {
    render(
      <ShopProvider>
        <Card />
      </ShopProvider>
    )
    const before = cardRenders
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(cardRenders).toBe(before)
  })
})

describe('ShopProvider currency', () => {
  function Switch() {
    const {currency, setCurrency} = useCurrency()
    return (
      <button
        type="button"
        onClick={() => {
          setCurrency('PLN')
        }}>
        {currency}
      </button>
    )
  }

  it('starts with the currency the server read from the cookie', () => {
    const html = renderToString(
      <ShopProvider initialCurrency="PLN">
        <Switch />
      </ShopProvider>
    )
    expect(html).toContain('PLN')
  })

  it('stores the choice in a cookie the API can read', () => {
    render(
      <ShopProvider>
        <Switch />
      </ShopProvider>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(document.cookie).toContain('currency=PLN')
  })
})

describe('ShopProvider cart', () => {
  it('renders the lines the server resolved, in the server HTML', () => {
    const html = renderToString(
      <ShopProvider initialLines={[{product, qty: 2}]}>
        <Cart />
      </ShopProvider>
    )
    expect(html).toContain('data-testid="count">2<')
  })

  it('does not write the cookie on mount, even under Strict Mode', async () => {
    render(
      <StrictMode>
        <ShopProvider initialLines={[]}>
          <Cart />
        </ShopProvider>
      </StrictMode>
    )
    await act(async () => {})
    expect(document.cookie).not.toContain('cart=')
  })

  it('writes the cookie when the cart changes', async () => {
    render(
      <ShopProvider>
        <Cart />
      </ShopProvider>
    )
    fireEvent.click(screen.getByRole('button', {name: 'add'}))
    fireEvent.click(screen.getByRole('button', {name: 'add'}))
    await act(async () => {})
    expect(document.cookie).toContain(`cart=${product.server}:${product.slug}:2`)
  })

  it('empties the cookie when the last line is removed', async () => {
    render(
      <ShopProvider initialLines={[{product, qty: 1}]}>
        <Cart />
      </ShopProvider>
    )
    fireEvent.click(screen.getByRole('button', {name: 'remove'}))
    await act(async () => {})
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(document.cookie).not.toMatch(/cart=[^;]/)
  })

  it(`ignores a new product once the cart holds ${String(MAX_LINES)} lines`, () => {
    const full = Array.from({length: MAX_LINES}, (_, i) => ({
      product: {...product, slug: `p${String(i)}`},
      qty: 1
    }))
    render(
      <ShopProvider initialLines={full}>
        <Cart />
      </ShopProvider>
    )
    fireEvent.click(screen.getByRole('button', {name: 'add'}))
    expect(screen.getByTestId('count')).toHaveTextContent(String(MAX_LINES))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/cart/shop-provider.test.tsx`
Expected: FAIL — the current provider calls `useCatalog()` outside `CatalogProvider` ("useCatalog must be used inside CatalogProvider"), and `initialLines`/`initialCurrency` are not props.

- [ ] **Step 3: Rewrite the provider**

Replace `apps/web/src/features/cart/shop-provider.tsx` with:

```tsx
'use client'

import {CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE, MAX_LINES, MAX_QTY} from '@/config/cart'
import {type Currency, DEFAULT_CURRENCY} from '@/config/currencies'
import {writeCartCookie} from '@/features/cart/lib/cart-cookie'
import type {CartItem} from '@/features/cart/types'
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {ReactNode} from 'react'

import type {CatalogProduct as Product} from '@shop/shared/catalog'

type CartLines = {lines: CartItem[]; count: number}
type CartActions = {
  add: (product: Product) => void
  /** One less, never below 1; removing a line is `remove`. */
  decrement: (product: Product) => void
  remove: (product: Product) => void
}
type CurrencyState = {currency: Currency; setCurrency: (currency: Currency) => void}

// Three contexts so a cart change does not re-render what only reads the currency or the (stable) actions, e.g. every product card.
const CurrencyContext = createContext<CurrencyState | null>(null)
const CartContext = createContext<CartLines | null>(null)
const ActionsContext = createContext<CartActions | null>(null)

function writeCurrencyCookie(currency: Currency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${String(CURRENCY_COOKIE_MAX_AGE)}; SameSite=Lax`
}

const isLine = (line: CartItem, product: Product) =>
  line.product.server === product.server && line.product.slug === product.slug

/**
 * Cart and currency. The layout resolves both from cookies on the server (`loadCart`), so the first
 * render already matches; each line keeps its product, so no catalog lookup is needed on the client.
 */
export function ShopProvider({
  initialLines = [],
  initialCurrency = DEFAULT_CURRENCY,
  children
}: {
  initialLines?: CartItem[]
  initialCurrency?: Currency
  children: ReactNode
}) {
  const [currency, setCurrencyState] = useState(initialCurrency)
  const [lines, setLines] = useState(initialLines)
  // Write the cookie only after the player changed the cart: a render with the API down starts
  // empty and must not wipe the stored cart.
  const changed = useRef(false)

  useEffect(() => {
    if (!changed.current) return
    writeCartCookie(lines.map(l => ({server: l.product.server, slug: l.product.slug, qty: l.qty})))
  }, [lines])

  const setCurrency = useCallback((next: Currency) => {
    writeCurrencyCookie(next)
    setCurrencyState(next)
  }, [])

  const update = useCallback((change: (current: CartItem[]) => CartItem[]) => {
    changed.current = true
    setLines(change)
  }, [])

  const add = useCallback(
    (product: Product) => {
      update(current => {
        const hit = current.find(l => isLine(l, product))
        if (hit)
          return hit.qty >= MAX_QTY
            ? current
            : current.map(l => (l === hit ? {...l, qty: l.qty + 1} : l))
        return current.length >= MAX_LINES ? current : [...current, {product, qty: 1}]
      })
    },
    [update]
  )

  const decrement = useCallback(
    (product: Product) => {
      update(current =>
        current.map(l => (isLine(l, product) && l.qty > 1 ? {...l, qty: l.qty - 1} : l))
      )
    },
    [update]
  )

  const remove = useCallback(
    (product: Product) => {
      update(current => current.filter(l => !isLine(l, product)))
    },
    [update]
  )

  const currencyValue = useMemo(() => ({currency, setCurrency}), [currency, setCurrency])
  const actions = useMemo(() => ({add, decrement, remove}), [add, decrement, remove])
  const cartValue = useMemo<CartLines>(
    () => ({lines, count: lines.reduce((sum, l) => sum + l.qty, 0)}),
    [lines]
  )

  return (
    <CurrencyContext value={currencyValue}>
      <ActionsContext value={actions}>
        <CartContext value={cartValue}>{children}</CartContext>
      </ActionsContext>
    </CurrencyContext>
  )
}

function useRequired<T>(ctx: T | null): T {
  if (!ctx) throw new Error('Shop hooks must be used inside <ShopProvider>')
  return ctx
}

export const useCurrency = () => useRequired(useContext(CurrencyContext))
export const useCart = () => useRequired(useContext(CartContext))
export const useCartActions = () => useRequired(useContext(ActionsContext))
```

Then in `apps/web/src/config/cart.ts` delete the line `export const CART_STORAGE_KEY = 'shop:v1'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @shop/web exec jest src/features/cart/shop-provider.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Wire the layout**

In `apps/web/src/app/[locale]/layout.tsx`:

1. Add the import (keep the import block sorted the way the file already is):

```tsx
import {loadCart} from '@/features/cart/api/load-cart'
```

2. After `const [settings, catalog] = await Promise.all([getSiteSettings(), loadCatalog(locale)])` add:

```tsx
const cart = await loadCart(catalog)
```

3. Replace `<ShopProvider>` with:

```tsx
              {/* Keyed by locale: a locale switch remounts it with lines named in the new locale. */}
              <ShopProvider key={locale} initialLines={cart.lines} initialCurrency={cart.currency}>
```

- [ ] **Step 6: Remove dead `localStorage.clear()` calls**

The cart no longer reads `localStorage`. Delete every `localStorage.clear()` line (and any `beforeEach` left empty by it) in:

- `apps/web/src/features/cart/components/cart-menu.test.tsx`
- `apps/web/src/features/checkout/components/checkout-modal.test.tsx`
- `apps/web/src/features/settings/components/settings-menu.test.tsx`
- `apps/web/src/features/catalog/components/catalog-add-to-cart.test.tsx`

Check none are left: `grep -rn "localStorage\|shop:v1" apps/web/src` → no output.

- [ ] **Step 7: Run the whole web suite**

Run: `pnpm --filter @shop/web test`
Expected: PASS (all suites; `cart-menu`, `checkout-modal`, `settings-menu`, `catalog-add-to-cart` still pass because `ShopProvider` defaults to an empty cart and EUR).

- [ ] **Step 8: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "feat(web): cart starts from the server and lives in a cookie"
```

---

### Task 4: Catalog provider keeps servers only

**Files:**

- Modify: `apps/web/src/features/catalog/catalog-provider.tsx` (whole file)
- Modify: `apps/web/src/features/catalog/components/catalog.tsx` (signature and the `useCatalog()` line)
- Modify: `apps/web/src/app/[locale]/_components/home-view.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/features/catalog/test-catalog.tsx` (`renderWithCatalog`)
- Test: `apps/web/src/features/catalog/catalog-provider.test.tsx`, `features/catalog/components/catalog.test.tsx`, `features/catalog/components/catalog-add-to-cart.test.tsx`, `features/checkout/components/checkout-modal.test.tsx`, `features/catalog/components/product-card.test.tsx`

**Interfaces:**

- Consumes: Task 3's `ShopProvider` (no longer needs `findProduct`).
- Produces:
  - `CatalogProvider({servers: CatalogServer[] | null; children})`; `useCatalog(): {available: boolean; servers: CatalogServer[]; findServer(slug): CatalogServer | undefined; categoryName(slug): string}`. `products` and `findProduct` are gone.
  - `Catalog({initialServer: string; products: CatalogProduct[]})`.
  - `renderWithCatalog(ui, catalog: CatalogResponse | null = TEST_CATALOG)` unchanged signature; provides `catalog?.servers ?? null`.

- [ ] **Step 1: Update the provider test (failing)**

Replace `apps/web/src/features/catalog/catalog-provider.test.tsx` with:

```tsx
import {renderWithCatalog} from '@/features/catalog/test-catalog'
import {screen} from '@testing-library/react'

import {useCatalog} from './catalog-provider'

function Probe() {
  const catalog = useCatalog()
  return (
    <p>
      {[
        String(catalog.available),
        String(catalog.servers.length),
        catalog.findServer('anarchy')?.name,
        catalog.categoryName('cosmetics'),
        catalog.categoryName('unknown'),
        String('products' in catalog)
      ].join('|')}
    </p>
  )
}

describe('CatalogProvider', () => {
  it('looks up servers and category names, and carries no products', () => {
    renderWithCatalog(<Probe />)
    expect(screen.getByText('true|3|Anarchy|Cosmetics|unknown|false')).toBeInTheDocument()
  })

  it('is empty and unavailable without a catalog', () => {
    renderWithCatalog(<Probe />, null)
    expect(screen.getByText('false|0||cosmetics|unknown|false')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/catalog/catalog-provider.test.tsx`
Expected: FAIL — the text ends in `|true` (the current context still has `products`).

- [ ] **Step 3: Shrink the provider**

Replace `apps/web/src/features/catalog/catalog-provider.tsx` with:

```tsx
'use client'

import {type ReactNode, createContext, use} from 'react'

import type {CatalogServer} from '@shop/shared/catalog'

type CatalogValue = {
  /** False when the API could not be reached and nothing was cached. */
  available: boolean
  servers: CatalogServer[]
  findServer: (slug: string) => CatalogServer | undefined
  categoryName: (slug: string) => string
}

const CatalogContext = createContext<CatalogValue | null>(null)

/**
 * Servers and their categories for every page. Products are not here: catalog pages pass them to
 * `<Catalog>` as a prop and the cart keeps its own, so other pages do not ship the product list.
 */
export function CatalogProvider({
  servers,
  children
}: {
  servers: CatalogServer[] | null
  children: ReactNode
}) {
  const list = servers ?? []
  const names = new Map(list.flatMap(s => s.categories.map(c => [c.slug, c.name] as const)))
  const value: CatalogValue = {
    available: servers !== null,
    servers: list,
    findServer: slug => list.find(s => s.slug === slug),
    categoryName: slug => names.get(slug) ?? slug
  }
  return <CatalogContext value={value}>{children}</CatalogContext>
}

export function useCatalog(): CatalogValue {
  const value = use(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
```

In `apps/web/src/features/catalog/test-catalog.tsx` replace `renderWithCatalog` with:

```tsx
export const renderWithCatalog = (
  ui: ReactElement,
  catalog: CatalogResponse | null = TEST_CATALOG
) => render(<CatalogProvider servers={catalog?.servers ?? null}>{ui}</CatalogProvider>)
```

- [ ] **Step 4: Give `<Catalog>` its products as a prop**

In `apps/web/src/features/catalog/components/catalog.tsx`:

```tsx
export function Catalog({
  initialServer,
  products
}: {
  initialServer: string
  products: CatalogProduct[]
}) {
  const {available, servers, findServer} = useCatalog()
```

(`CatalogProduct` is already imported as a type in this file; keep the rest of the component unchanged.)

In `apps/web/src/app/[locale]/_components/home-view.tsx` replace `<Catalog initialServer={server} />` with:

```tsx
<Catalog initialServer={server} products={catalog?.products ?? []} />
```

In `apps/web/src/app/[locale]/layout.tsx` replace `<CatalogProvider catalog={catalog}>` with:

```tsx
          <CatalogProvider servers={catalog?.servers ?? null}>
```

- [ ] **Step 5: Update the remaining tests to the new props**

1. In `catalog.test.tsx` and `catalog-add-to-cart.test.tsx` replace every `<Catalog initialServer="<slug>" />` with `<Catalog initialServer="<slug>" products={TEST_CATALOG.products} />`, except the "shows the unavailable state without a catalog" test, which becomes:

```tsx
renderWithCatalog(<Catalog initialServer="survival" products={[]} />, null)
```

2. In `catalog.test.tsx`, `checkout-modal.test.tsx` and `product-card.test.tsx` replace `<CatalogProvider catalog={TEST_CATALOG}>` with `<CatalogProvider servers={TEST_CATALOG.servers}>`.

Check: `grep -rn "CatalogProvider catalog=\|findProduct\|useCatalog().products" apps/web/src` → no output.

- [ ] **Step 6: Run the whole web suite**

Run: `pnpm --filter @shop/web test`
Expected: PASS (all suites).

- [ ] **Step 7: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "refactor(web): catalog context carries servers only"
```

---

### Task 5: e2e and docs

**Files:**

- Create: `e2e/tests/cart.spec.ts`
- Modify: `e2e/tests/catalog.spec.ts` (drop the `localStorage` cart test and `CART_STORAGE_KEY`)
- Modify: `docs/adr/0007-request-time-rendering.md` (Consequences)
- Modify: `CLAUDE.md` (catalog rule)
- Modify: `docs/superpowers/specs/2026-10-09-data-catalog-design.md` (decision #9 row)

**Interfaces:**

- Consumes: everything above, through the running stack (`http://shop.localhost`, seeded data: `survival/vip` named "VIP", price 4.99 EUR).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the e2e tests**

`e2e/tests/cart.spec.ts`:

```ts
import {type BrowserContext, expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

const setCart = (context: BrowserContext, value: string) =>
  context.addCookies([{name: 'cart', value, url: WEB}])

test('the cart is in the server HTML and /rules ships no other products', async ({context}) => {
  await setCart(context, 'survival:vip:2')
  const html = await (await context.request.get(`${WEB}/rules`)).text()
  expect(html).toContain('Cart, 2 items')
  // An Anarchy product: on the catalog pages, never on /rules unless it is in the cart.
  expect(html).not.toContain('shards-2500')
})

test('a cart line for a product that no longer exists is dropped', async ({context, page}) => {
  await setCart(context, 'survival:vip:1|survival:gone-forever:3')
  await page.goto(`${WEB}/`)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('a product added on home is still in the cart on /rules', async ({context, page}) => {
  await page.goto(`${WEB}/`)
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
  expect((await context.cookies()).find(c => c.name === 'cart')?.value).toBe('survival:vip:1')
  await page.goto(`${WEB}/rules`)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('the cart survives a locale switch', async ({context, page}) => {
  await setCart(context, 'survival:vip:2')
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByRole('button', {name: /^Koszyk, 2 przedmioty$/})).toBeVisible()
})
```

Before relying on `shards-2500`, confirm it is an Anarchy product in `apps/api/src/seed/demo-products.ts` and appears nowhere in `apps/web/src/features/rules/data/`: `grep -rn "shards-2500" apps/api/src/seed apps/web/src/features/rules` → only the seed line. If it is not Anarchy-only, use another slug that exists only on a server other than Survival.

- [ ] **Step 2: Remove the old `localStorage` test**

In `e2e/tests/catalog.spec.ts` delete `const CART_STORAGE_KEY = 'shop:v1'` and the whole test `'a saved cart line for a product that no longer exists is dropped'` (it moved to `cart.spec.ts` in cookie form).

- [ ] **Step 3: Run e2e against the stack**

Run (Docker required):

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait
pnpm --filter @shop/e2e exec playwright test tests/cart.spec.ts tests/catalog.spec.ts --project=chromium
```

Expected: PASS. `cart.spec.ts` would fail before Tasks 3–4 (no cookie support; `/rules` HTML contains every product).
If Docker is unavailable, say so in the report; CI runs these.

- [ ] **Step 4: Update the docs**

1. `docs/adr/0007-request-time-rendering.md`, append to Consequences:

```markdown
- The layout reads the `cart` and `currency` cookies (`docs/superpowers/specs/2026-10-12-cart-cookie-design.md`), so the HTML is per visitor and cannot be cached by a CDN. This adds no cost while every route already renders per request.
```

2. `CLAUDE.md`, replace the line starting `- Catalog data comes from` with:

```markdown
- Catalog data comes from `GET /api/catalog` (contract in `@shop/shared`); web reads it with `getCatalog` on the server, never from `config/`. The layout gives `CatalogProvider` servers only; catalog pages pass products to `<Catalog>` as a prop. The cart lives in the `cart` cookie and is resolved on the server (`loadCart`). Locale routes render at request time (ADR 0007).
```

3. `docs/superpowers/specs/2026-10-09-data-catalog-design.md`, in decision #9's row, append: ` **Amended by** \`2026-10-12-cart-cookie-design.md\`: the provider carries servers only.`

- [ ] **Step 5: Gate and commit**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add e2e/tests/cart.spec.ts e2e/tests/catalog.spec.ts docs/adr/0007-request-time-rendering.md CLAUDE.md docs/superpowers/specs/2026-10-09-data-catalog-design.md
git commit -m "test(e2e): cart cookie; docs: catalog and cart rules"
```
