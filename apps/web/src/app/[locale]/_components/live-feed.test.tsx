import {render, screen} from '@testing-library/react'

import {LiveFeed, STUB_PURCHASES} from './live-feed'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const marquee = () => document.querySelector('.feed-marquee')

describe('LiveFeed', () => {
  it('shows only the empty message when there are no purchases', () => {
    render(<LiveFeed purchases={[]} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(marquee()).toBeNull()
  })

  it('keeps a short feed still', () => {
    render(<LiveFeed purchases={STUB_PURCHASES.slice(0, 2)} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(marquee()).toBeNull()
  })

  it('runs a full feed as a marquee with the loop copy hidden from assistive tech', () => {
    render(<LiveFeed purchases={STUB_PURCHASES} />)
    expect(marquee()).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(STUB_PURCHASES.length)
  })
})
