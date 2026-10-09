import type {RuleSection} from '@/features/rules/types'
import {fireEvent, render, screen} from '@testing-library/react'

import {RulesToc} from './rules-toc'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const section = (n: number, title: string, items: number): RuleSection => ({
  id: title,
  number: n,
  anchor: `s-${String(n)}`,
  title: {value: title, lang: 'en'},
  items: Array.from({length: items}, (_, i) => ({
    id: `${title}-${String(i)}`,
    number: `${String(n)}.${String(i + 1)}`,
    anchor: `r-${String(n)}-${String(i + 1)}`,
    text: {value: 'x', lang: 'en' as const}
  }))
})

const sections = [section(1, 'General', 4), section(2, 'Chat', 3)]

describe('RulesToc', () => {
  it('links every section with its number and item count', () => {
    render(<RulesToc sections={sections} active="s-1" />)
    const link = screen.getByRole('link', {name: /Chat/})
    expect(link).toHaveAttribute('href', '#s-2')
    expect(link).toHaveTextContent('2')
    expect(link).toHaveTextContent('3')
  })

  it('marks the active section', () => {
    render(<RulesToc sections={sections} active="s-2" />)
    expect(screen.getByRole('link', {name: /Chat/})).toHaveAttribute('aria-current', 'location')
    expect(screen.getByRole('link', {name: /General/})).not.toHaveAttribute('aria-current')
  })

  it('reports navigation so a popover can close', () => {
    const onNavigate = jest.fn()
    render(<RulesToc sections={sections} active="s-1" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('link', {name: /Chat/}))
    expect(onNavigate).toHaveBeenCalled()
  })
})
