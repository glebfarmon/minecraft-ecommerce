import {render, screen} from '@testing-library/react'
import type {ReactNode} from 'react'

import {Footer} from './footer'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
// The live player count is not under test.
jest.mock('@/features/status/components/online-badge', () => ({OnlineBadge: () => null}))
// next-intl/navigation is ESM-only in jest; a plain anchor keeps the href under test.
jest.mock('@/i18n/navigation', () => ({
  Link: ({href, children, className}: {href: string; children: ReactNode; className?: string}) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}))

const settings = {
  siteName: {plain: 'BLOCK', accent: 'HAUS'},
  serverIp: 'play.example.net',
  discordUrl: 'https://discord.gg/example',
  supportEmail: 'support@example.net'
}

describe('Footer', () => {
  it('sends FAQ to the home page section from any page', () => {
    render(<Footer settings={settings as never} servers={[]} />)
    expect(screen.getByRole('link', {name: 'faq'})).toHaveAttribute('href', '/#faq')
  })
})
