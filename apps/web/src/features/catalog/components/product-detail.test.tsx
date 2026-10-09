import type {Product} from '@/config/products'
import {products} from '@/config/products'
import {findServer} from '@/lib/catalog'
import {fireEvent, render, screen} from '@testing-library/react'

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

const product = products[0] as Product
const server = findServer(product.server)

describe('ProductDetail add to cart', () => {
  it('adds the product and then reports it so the modal can close', () => {
    if (!server) throw new Error('missing server')
    const onAdded = jest.fn()
    render(<ProductDetail product={product} server={server} titleId="t" onAdded={onAdded} />)
    fireEvent.click(screen.getByRole('button', {name: 'addToCart'}))
    expect(add).toHaveBeenCalledWith(product)
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  // The modal is still on screen (and above the cart); the card flies once the modal has become the card again.
  it('does not start the flight itself', () => {
    if (!server) throw new Error('missing server')
    flyToCart.mockClear()
    render(<ProductDetail product={product} server={server} titleId="t" onAdded={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'addToCart'}))
    expect(flyToCart).not.toHaveBeenCalled()
  })
})
