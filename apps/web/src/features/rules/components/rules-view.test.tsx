import {RULES_SEARCH_DELAY_MS} from '@/config/rules'
import type {RuleSection} from '@/features/rules/types'
import {act, fireEvent, render, screen, within} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {renderToString} from 'react-dom/server'

import {RulesView} from './rules-view'

jest.mock('next-intl', () => ({
  useLocale: () => 'pl',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(',')}` : key
}))

// jsdom never finishes an exit animation; sections leaving the list unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
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
const type = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', {name: 'searchLabel'}), {target: {value}})
}
const settle = () => {
  act(() => {
    jest.advanceTimersByTime(RULES_SEARCH_DELAY_MS)
  })
}
const search = (value: string) => {
  type(value)
  settle()
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

describe('RulesView', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('waits for the reader to stop typing before filtering', () => {
    setup()
    type('zlosliwe')
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
    settle()
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1)
  })

  it('shows every section again at once when the search is cleared', () => {
    setup()
    search('zlosliwe')
    type('')
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })

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

  describe('phone shortcuts', () => {
    it('keeps search and contents in floating buttons', () => {
      setup()
      const dock = screen.getByTestId('rules-dock')
      expect(within(dock).getByRole('button', {name: 'openSearch'})).toBeInTheDocument()
      expect(within(dock).getByRole('button', {name: 'openContents'})).toBeInTheDocument()
    })

    it('searches from the floating panel', () => {
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'openSearch'}))
      const panel = screen.getByRole('dialog', {name: 'searchLabel'})
      fireEvent.change(within(panel).getByRole('searchbox'), {target: {value: 'zlosliwe'}})
      settle()
      expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1)
    })
  })

  it('ships the sections in their entrance pose, like the home hero', () => {
    const html = renderToString(<RulesView sections={sections} rulesPath="/pl/rules" />)
    expect(html).toMatch(/opacity:0;transform:translateY\(12px\)[^>]*><section id="s-1"/)
  })
})
