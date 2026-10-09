import type {RuleSection} from '@/features/rules/types'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {RulesView} from './rules-view'

jest.mock('next-intl', () => ({
  useLocale: () => 'pl',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(',')}` : key
}))

const pl = (value: string) => ({value, lang: 'pl' as const})

const sections: RuleSection[] = [
  {
    id: 'chat',
    number: 1,
    anchor: 's-1',
    title: pl('Czat'),
    items: [{id: 'c1', number: '1.1', anchor: 'r-1-1', text: pl('Zakaz spamu.')}]
  },
  {
    id: 'cheats',
    number: 2,
    anchor: 's-2',
    title: pl('Sprawdzanie'),
    items: [{id: 'x1', number: '2.1', anchor: 'r-2-1', text: pl('**Złośliwe** oprogramowanie.')}]
  }
]

const setup = () => render(<RulesView sections={sections} rulesPath="/pl/rules" />)
const search = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', {name: 'searchLabel'}), {target: {value}})
}

describe('RulesView', () => {
  it('shows every section', () => {
    setup()
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })

  it('filters by query and highlights', () => {
    const {container} = setup()
    search('zlosliwe')
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1)
    expect(container.querySelector('mark')).toHaveTextContent('Złośliwe')
  })

  it('shows an empty state that clears the search', () => {
    setup()
    search('nic takiego')
    expect(screen.getByText('noResults nic takiego')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', {name: 'clearSearch'}).at(-1) as HTMLElement)
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })

  it('clears the search when a rule link changes the hash', () => {
    setup()
    search('zlosliwe')
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })
})
