import type {RuleSection} from '@/features/rules/types'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {RulesSection} from './rules-section'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(',')}` : key
}))

const section: RuleSection = {
  id: 'chat',
  number: 2,
  anchor: 's-2',
  title: {value: 'Czat', lang: 'pl'},
  items: [
    {
      id: 'c1',
      number: '2.1',
      anchor: 'r-2-1',
      text: {value: '**Obelgi** są zabronione.', lang: 'pl'}
    },
    {id: 'c2', number: '2.2', anchor: 'r-2-2', text: {value: 'No spam.', lang: 'en'}}
  ]
}

const setup = (query = '') =>
  render(<RulesSection section={section} query={query} locale="pl" rulesPath="/pl/rules" />)

describe('RulesSection', () => {
  it('renders the numbered heading, count and anchored items', () => {
    setup()
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('2. Czat')
    expect(screen.getByText('itemCount 2')).toBeInTheDocument()
    expect(document.getElementById('s-2')).not.toBeNull()
    expect(document.getElementById('r-2-1')).not.toBeNull()
    expect(screen.getByRole('link', {name: '2.1'})).toHaveAttribute('href', '#r-2-1')
  })

  it('marks a fallback text with its own language', () => {
    setup()
    expect(screen.getByText('No spam.')).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/są zabronione/).closest('[lang]')).toBeNull()
  })

  it('highlights matches inside formatted text', () => {
    const {container} = setup('obelgi')
    expect(container.querySelector('strong mark')).toHaveTextContent('Obelgi')
  })

  it('copies the plain text of a rule', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true})
    setup()
    fireEvent.click(screen.getByRole('button', {name: 'copyText 2.1'}))
    await act(() => Promise.resolve())
    expect(writeText).toHaveBeenCalledWith('2.1. Obelgi są zabronione.')
  })
})
