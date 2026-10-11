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
