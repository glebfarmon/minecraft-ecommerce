import type {Product} from '@/lib/catalog'
import {products} from '@/lib/catalog'
import {fireEvent, render, screen} from '@testing-library/react'

import {ProductCard} from './product-card'

jest.mock('next-intl', () => ({
  useLocale: () => 'pl',
  useTranslations: () => (key: string) => key
}))
jest.mock('@/features/cart/shop-provider', () => ({
  useCurrency: () => ({currency: 'PLN'}),
  useCartActions: () => ({add: jest.fn()})
}))

const product = products[0] as Product

describe('ProductCard footer', () => {
  it('shows the full currency code and a labeled add button', () => {
    render(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.getByText(/PLN|zł/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'add'})).toHaveTextContent('addShort')
  })

  it('stacks price above the button so a long price cannot push it out', () => {
    render(<ProductCard product={product} onOpen={jest.fn()} />)
    const price = screen.getByText(/PLN|zł/)
    expect(price).toHaveClass('whitespace-nowrap')
    expect(price.parentElement).toHaveClass('flex-col')
    expect(price.parentElement).toContainElement(screen.getByRole('button', {name: 'add'}))
  })
})

describe('ProductCard opening', () => {
  it('clicking the title opens the modal', () => {
    const onOpen = jest.fn()
    render(<ProductCard product={product} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', {name: product.name}))
    expect(onOpen).toHaveBeenCalledWith(product)
  })

  it('has no link to a product page', () => {
    render(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
