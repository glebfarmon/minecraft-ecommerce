'use client'

import type {Currency, Product} from '@/lib/catalog'
import {findProduct} from '@/lib/catalog'
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {ReactNode} from 'react'

type CartLine = {server: string; slug: string; qty: number}

type CartLines = {lines: {product: Product; qty: number}[]; count: number}
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

/** Per-line quantity cap; `add` ignores anything past it. */
export const MAX_QTY = 99

const STORAGE_KEY = 'shop:v1'
// A cookie rather than localStorage so the API receives the chosen currency with every request.
const CURRENCY_COOKIE = 'currency'
const YEAR_SECONDS = 365 * 24 * 60 * 60

const isCurrency = (value: unknown): value is Currency => value === 'EUR' || value === 'PLN'

function readCurrencyCookie() {
  const value = document.cookie
    .split('; ')
    .find(part => part.startsWith(`${CURRENCY_COOKIE}=`))
    ?.slice(CURRENCY_COOKIE.length + 1)
  return isCurrency(value) ? value : undefined
}

function writeCurrencyCookie(currency: Currency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${String(YEAR_SECONDS)}; SameSite=Lax`
}

// The cart lives in localStorage; older versions also kept the currency there.
function loadSaved(): {currency?: unknown; cart?: unknown} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as {currency?: unknown; cart?: unknown}) : {}
  } catch {
    return {}
  }
}

export function ShopProvider({children}: {children: ReactNode}) {
  const [{currency, cart}, setState] = useState<{currency: Currency; cart: CartLine[]}>({
    currency: 'EUR',
    cart: []
  })
  const hydrated = useRef(false)

  // Restore after mount so server and first client render match.
  useEffect(() => {
    const saved = loadSaved()
    hydrated.current = true
    const legacy = isCurrency(saved.currency) ? saved.currency : undefined
    const restoredCurrency = readCurrencyCookie() ?? legacy
    if (!readCurrencyCookie() && legacy) writeCurrencyCookie(legacy)
    const restoredCart = Array.isArray(saved.cart) ? (saved.cart as CartLine[]) : []
    if (!restoredCurrency && restoredCart.length === 0) return
    queueMicrotask(() => {
      setState({currency: restoredCurrency ?? 'EUR', cart: restoredCart})
    })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({cart}))
    } catch {
      // Storage unavailable (private mode); the cart just won't survive a reload.
    }
  }, [cart])

  const setCurrency = useCallback((next: Currency) => {
    writeCurrencyCookie(next)
    setState(s => ({...s, currency: next}))
  }, [])

  const setCart = useCallback((update: (lines: CartLine[]) => CartLine[]) => {
    setState(s => ({...s, cart: update(s.cart)}))
  }, [])

  const add = useCallback(
    (product: Product) => {
      setCart(lines => {
        const hit = lines.find(l => l.server === product.server && l.slug === product.slug)
        if (hit)
          return hit.qty >= MAX_QTY
            ? lines
            : lines.map(l => (l === hit ? {...l, qty: l.qty + 1} : l))
        return [...lines, {server: product.server, slug: product.slug, qty: 1}]
      })
    },
    [setCart]
  )

  const decrement = useCallback(
    (product: Product) => {
      setCart(lines =>
        lines.map(l =>
          l.server === product.server && l.slug === product.slug && l.qty > 1
            ? {...l, qty: l.qty - 1}
            : l
        )
      )
    },
    [setCart]
  )

  const remove = useCallback(
    (product: Product) => {
      setCart(lines => lines.filter(l => !(l.server === product.server && l.slug === product.slug)))
    },
    [setCart]
  )

  const currencyValue = useMemo(() => ({currency, setCurrency}), [currency, setCurrency])
  const actions = useMemo(() => ({add, decrement, remove}), [add, decrement, remove])
  const cartValue = useMemo<CartLines>(() => {
    const lines = cart.flatMap(l => {
      const product = findProduct(l.server, l.slug)
      return product ? [{product, qty: l.qty}] : []
    })
    return {lines, count: lines.reduce((sum, l) => sum + l.qty, 0)}
  }, [cart])

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
