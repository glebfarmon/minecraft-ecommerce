import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {render, screen} from '@testing-library/react'

import type {RecentPurchase} from '@shop/shared/orders'

import {LiveFeed} from './live-feed'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const purchase = (n: number, server = 'survival', product = 'vip'): RecentPurchase => ({
  id: String(n),
  nick: `Buyer_${String(n)}`,
  server,
  product,
  currency: 'EUR',
  amountMinor: 499,
  paidAt: new Date(Date.now() - n * 60_000).toISOString()
})

const marquee = () => document.querySelector('.feed-marquee')

describe('LiveFeed', () => {
  it('shows each purchase with its nick, product, real amount and age', () => {
    render(<LiveFeed catalog={TEST_CATALOG} recent={[purchase(3)]} />)
    expect(screen.getByText('Buyer_3')).toBeInTheDocument()
    expect(screen.getByText(/3 min\. ago/)).toBeInTheDocument()
    expect(screen.getByText(/^4\.99\s€$/)).toBeInTheDocument()
    expect(marquee()).toBeNull()
  })

  it('skips purchases whose product is no longer in the catalog', () => {
    render(
      <LiveFeed catalog={TEST_CATALOG} recent={[purchase(1), purchase(2, 'survival', 'gone')]} />
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('runs a full feed as a marquee with the loop copy hidden from assistive tech', () => {
    const recent = Array.from({length: 6}, (_, i) => purchase(i + 1))
    const {container} = render(<LiveFeed catalog={TEST_CATALOG} recent={recent} />)
    expect(marquee()).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    const lists = container.querySelectorAll('.feed-marquee ul')
    expect(lists).toHaveLength(2)
    expect(container.querySelectorAll('.feed-marquee li')).toHaveLength(12)
    expect(lists[0]).not.toHaveAttribute('aria-hidden')
    expect(lists[1]).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the empty message when there are no purchases', () => {
    render(<LiveFeed catalog={TEST_CATALOG} recent={[]} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(marquee()).toBeNull()
  })

  it('renders nothing without a catalog', () => {
    const {container} = render(<LiveFeed catalog={null} recent={[purchase(1)]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
