import {ShopProvider, useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import type {Product} from '@/lib/catalog'
import {products} from '@/lib/catalog'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {StrictMode} from 'react'

const [first] = products
if (!first) throw new Error('catalog is empty')
const product: Product = first

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

describe('ShopProvider contexts', () => {
  beforeEach(() => {
    localStorage.clear()
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

  describe('currency cookie', () => {
    const clearCookie = () => {
      document.cookie = 'currency=; path=/; max-age=0'
    }
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
    const mount = () =>
      render(
        <ShopProvider>
          <Switch />
        </ShopProvider>
      )

    beforeEach(clearCookie)
    afterEach(clearCookie)

    it('stores the choice in a cookie the API can read', () => {
      mount()
      fireEvent.click(screen.getByRole('button'))
      expect(document.cookie).toContain('currency=PLN')
    })

    it('restores the choice from the cookie on mount', async () => {
      document.cookie = 'currency=PLN; path=/'
      mount()
      expect(await screen.findByRole('button', {name: 'PLN'})).toBeInTheDocument()
    })

    it('migrates a currency left in localStorage by an older version', async () => {
      localStorage.setItem('shop:v1', JSON.stringify({currency: 'PLN', cart: []}))
      mount()
      expect(await screen.findByRole('button', {name: 'PLN'})).toBeInTheDocument()
      expect(document.cookie).toContain('currency=PLN')
    })

    it('ignores a cookie with an unknown currency', async () => {
      document.cookie = 'currency=XXX; path=/'
      mount()
      await act(async () => {})
      expect(screen.getByRole('button', {name: 'EUR'})).toBeInTheDocument()
    })
  })

  describe('saved cart', () => {
    function Count() {
      const {count} = useCart()
      return <p data-testid="count">{count}</p>
    }
    const mount = (strict = false) => {
      const tree = (
        <ShopProvider>
          <Count />
        </ShopProvider>
      )
      return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
    }
    const save = (cart: unknown) => {
      localStorage.setItem('shop:v1', JSON.stringify({cart}))
    }

    it('restores the cart', async () => {
      save([{server: product.server, slug: product.slug, qty: 2}])
      mount()
      await act(async () => {})
      expect(screen.getByTestId('count')).toHaveTextContent('2')
    })

    it('restores the cart under Strict Mode (effects run twice)', async () => {
      document.cookie = 'currency=PLN; path=/'
      save([{server: product.server, slug: product.slug, qty: 2}])
      mount(true)
      await act(async () => {})
      expect(screen.getByTestId('count')).toHaveTextContent('2')
      document.cookie = 'currency=; path=/; max-age=0'
    })

    it('survives malformed saved lines', async () => {
      save([null, 7, 'x', {server: product.server, slug: product.slug, qty: 1}])
      mount()
      await act(async () => {})
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('clamps a saved quantity into 1..MAX_QTY', async () => {
      save([{server: product.server, slug: product.slug, qty: 5000}])
      mount()
      await act(async () => {})
      expect(screen.getByTestId('count')).toHaveTextContent('99')
    })

    it('drops lines with a non-numeric or non-positive quantity', async () => {
      save([
        {server: product.server, slug: product.slug, qty: 'many'},
        {server: product.server, slug: product.slug, qty: 0}
      ])
      mount()
      await act(async () => {})
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })
})
