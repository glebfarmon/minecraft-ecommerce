import {TEST_CATALOG, renderWithCatalog} from '@/features/catalog/test-catalog'
import {fireEvent, screen} from '@testing-library/react'

import type {CatalogProduct, CatalogServer} from '@shop/shared/catalog'

import {ProductDetail} from './product-detail'

const add = jest.fn()
const flyToCart = jest.fn()
jest.mock('@/lib/fly-to-cart', () => ({
  flyToCart: (el: unknown) => {
    flyToCart(el)
  }
}))
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
jest.mock('@/features/cart/shop-provider', () => ({
  useCurrency: () => ({currency: 'EUR'}),
  useCart: () => ({lines: []}),
  useCartActions: () => ({add})
}))

const product = TEST_CATALOG.products[0] as CatalogProduct
const server = TEST_CATALOG.servers[0] as CatalogServer

describe('ProductDetail add to cart', () => {
  it('adds the product and then reports it so the modal can close', () => {
    const onAdded = jest.fn()
    renderWithCatalog(
      <ProductDetail product={product} server={server} titleId="t" onAdded={onAdded} />
    )
    fireEvent.click(screen.getByRole('button', {name: 'addToCart'}))
    expect(add).toHaveBeenCalledWith(product)
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  // The modal is still on screen (and above the cart); the card flies once the modal has become the card again.
  it('does not start the flight itself', () => {
    flyToCart.mockClear()
    renderWithCatalog(
      <ProductDetail product={product} server={server} titleId="t" onAdded={jest.fn()} />
    )
    fireEvent.click(screen.getByRole('button', {name: 'addToCart'}))
    expect(flyToCart).not.toHaveBeenCalled()
  })
})
