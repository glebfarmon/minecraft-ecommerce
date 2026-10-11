import {ShopProvider} from '@/features/cart/shop-provider'
import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {render} from '@testing-library/react'

import type {CatalogProduct} from '@shop/shared/catalog'

import {CartTabSync} from './cart-tab-sync'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({useRouter: () => ({refresh})}))

const [first] = TEST_CATALOG.products
if (!first) throw new Error('catalog is empty')
const product: CatalogProduct = first

const mount = () =>
  render(
    <ShopProvider initialLines={[{product, qty: 1}]}>
      <CartTabSync />
    </ShopProvider>
  )
const showTab = () => document.dispatchEvent(new Event('visibilitychange'))

describe('CartTabSync', () => {
  beforeEach(() => {
    refresh.mockClear()
  })
  afterEach(() => {
    document.cookie = 'cart=; path=/; max-age=0'
  })

  it('refreshes when another tab changed the cart cookie', () => {
    mount()
    document.cookie = `cart=${product.server}:${product.slug}:2; path=/`
    showTab()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the cookie still matches this tab', () => {
    mount()
    document.cookie = `cart=${product.server}:${product.slug}:1; path=/`
    showTab()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes a page restored from the back/forward cache when the cookie changed', () => {
    mount()
    document.cookie = `cart=${product.server}:${product.slug}:5; path=/`
    window.dispatchEvent(Object.assign(new Event('pageshow'), {persisted: true}))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
