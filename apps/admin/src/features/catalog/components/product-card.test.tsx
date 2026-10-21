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

  it('shows the description, clamped to two muted lines, only when given', () => {
    const {rerender} = render(<ProductCard product={product} accent="#ff6b1a" />)
    expect(screen.queryByTestId('product-description')).not.toBeInTheDocument()
    rerender(<ProductCard product={product} accent="#ff6b1a" description="Fly and more" />)
    const text = screen.getByText('Fly and more')
    expect(text).toHaveClass('line-clamp-2', 'text-muted')
  })
})
