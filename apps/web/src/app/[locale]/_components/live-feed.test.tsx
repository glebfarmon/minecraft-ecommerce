import {TEST_CATALOG} from '@/features/catalog/test-catalog'
import {render, screen} from '@testing-library/react'

import {LiveFeed} from './live-feed'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
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
