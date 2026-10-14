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

  it('adopts the lines the server sends when the layout re-renders (e.g. after router.refresh)', () => {
    const {rerender} = render(
      <ShopProvider initialLines={[{product, qty: 1}]}>
        <Cart />
      </ShopProvider>
    )
    rerender(
      <ShopProvider initialLines={[{product, qty: 3}]}>
        <Cart />
      </ShopProvider>
    )
    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })
})
