import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {fireEvent, render, screen} from '@testing-library/react'

import type {CatalogProduct} from '@shop/shared/catalog'

import {AddToCartButton} from './add-to-cart'

const add = jest.fn()
jest.mock('next-intl', () => ({useTranslations: () => (key: string) => key}))
jest.mock('@/features/cart/shop-provider', () => ({useCartActions: () => ({add})}))
jest.mock('@/lib/fly-to-cart', () => ({flyToCart: jest.fn()}))

const product = TEST_CATALOG.products[0] as CatalogProduct

beforeEach(() => {
  add.mockClear()
})

describe('AddToCartButton', () => {
  it('adds the product when its server can deliver', () => {
    render(<AddToCartButton product={product} purchasable />)
    fireEvent.click(screen.getByRole('button', {name: 'add'}))
    expect(add).toHaveBeenCalledWith(product)
  })

  it('is disabled and writes nothing when the server has no usable RCON', () => {
    render(<AddToCartButton product={product} purchasable={false} />)
    const button = screen.getByRole('button', {name: 'unavailableProduct'})
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(add).not.toHaveBeenCalled()
  })
})
