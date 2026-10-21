import {renderWithIntl as render} from '@/test/render-with-providers'
import {screen} from '@testing-library/react'

import {ProductCard} from './product-card'

const product = {
  name: 'VIP',
  mark: 'VIP',
  icon: 'crown' as const,
  kind: 'PERMANENT' as const,
  isActive: true,
  prices: {EUR: 499, PLN: 2199},
  missing: []
}

describe('ProductCard', () => {
  it('does not underline the name on hover (the card changes background instead)', () => {
    render(<ProductCard product={product} accent="#ff6b1a" href="/catalog/products/p1" />)
    expect(screen.getByRole('link', {name: 'VIP'}).className).not.toContain('underline')
  })
})
