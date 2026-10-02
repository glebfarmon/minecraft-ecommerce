import type {Product} from '@/config/products'
import {products} from '@/config/products'
import {findServer} from '@/lib/catalog'
import {fireEvent, render, screen} from '@testing-library/react'

import {ProductDetail} from './product-detail'

const add = jest.fn()
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
})
