import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {render, screen} from '@testing-library/react'

import {LiveFeed} from './live-feed'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const base = TEST_CATALOG.products.find(p => p.slug === 'vip')
if (!base) throw new Error('fixture lost vip')

const extraProducts = [
  ['survival', 'starter-kit'],
  ['anarchy', 'warlord'],
  ['survival', 'coins-5000'],
  ['minigames', 'champion']
].map(([server, slug]) => ({
  ...base,
  server: server ?? '',
  slug: slug ?? '',
  name: slug ?? ''
}))

const marquee = () => document.querySelector('.feed-marquee')

describe('LiveFeed', () => {
  it('shows only purchases whose product is still in the catalog', () => {
    render(<LiveFeed catalog={TEST_CATALOG} />)
    // Of the stub purchases, only vip, legend, mythic-case and pvp-kit exist in the fixture.
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/champion/i)).toBeNull()
    expect(marquee()).toBeNull()
  })

  it('runs a full feed as a marquee with the loop copy hidden from assistive tech', () => {
    const catalog = {...TEST_CATALOG, products: [...TEST_CATALOG.products, ...extraProducts]}
    const {container} = render(<LiveFeed catalog={catalog} />)
    expect(marquee()).not.toBeNull()
    // 8 purchases; the hidden loop copy is left out of the accessibility tree.
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    const lists = container.querySelectorAll('.feed-marquee ul')
    expect(lists).toHaveLength(2)
    expect(container.querySelectorAll('.feed-marquee li')).toHaveLength(16)
    expect(lists[0]).not.toHaveAttribute('aria-hidden')
    expect(lists[1]).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the empty message when no stub product is in the catalog', () => {
    render(<LiveFeed catalog={{...TEST_CATALOG, products: []}} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(marquee()).toBeNull()
  })

  it('renders nothing without a catalog', () => {
    const {container} = render(<LiveFeed catalog={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
