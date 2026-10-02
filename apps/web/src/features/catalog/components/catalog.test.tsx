import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {renderToString} from 'react-dom/server'

import {Catalog} from './catalog'

let mockLocale = 'en'
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key
}))
// next-intl/navigation is ESM-only in jest; this mirrors its `as-needed` rule (default locale `en` has no prefix).
jest.mock('@/i18n/navigation', () => ({
  getPathname: ({locale, href}: {locale: string; href: string}) =>
    locale === 'en' ? href : `/${locale}${href}`
}))
// The product cards need the shop provider; the URL logic under test does not.
jest.mock('@/features/catalog/components/product-card', () => ({ProductCard: () => null}))

describe('Catalog server switcher', () => {
  let pushState: jest.SpyInstance

  beforeEach(() => {
    pushState = jest.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
  })
  afterEach(() => {
    pushState.mockRestore()
  })

  it('leaves the default locale unprefixed', () => {
    mockLocale = 'en'
    render(<Catalog initialServer="survival" />)
    fireEvent.click(screen.getByRole('button', {name: 'Anarchy'}))
    expect(pushState).toHaveBeenCalledWith(null, '', '/anarchy')
  })

  it('prefixes other locales', () => {
    mockLocale = 'pl'
    render(<Catalog initialServer="survival" />)
    fireEvent.click(screen.getByRole('button', {name: 'Anarchy'}))
    expect(pushState).toHaveBeenCalledWith(null, '', '/pl/anarchy')
  })

  it('scrolls the server row to the selected server', () => {
    mockLocale = 'en'
    const scrollBy = jest.spyOn(Element.prototype, 'scrollBy')
    render(<Catalog initialServer="survival" />)
    scrollBy.mockClear() // ignore the initial mount
    fireEvent.click(screen.getByRole('button', {name: 'next'}))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    expect(scrollBy.mock.contexts[0]).toBe(
      screen.getByRole('button', {name: 'Anarchy'}).parentElement
    )
  })
})

describe('Catalog category arrows', () => {
  const pressed = (name: string) =>
    screen.getAllByRole('button', {name}).every(b => b.getAttribute('aria-pressed') === 'true')

  it('steps through the categories and wraps around', () => {
    render(<Catalog initialServer="survival" />)
    expect(pressed('all')).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'nextCategory'}))
    expect(pressed('ranks')).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'prevCategory'}))
    fireEvent.click(screen.getByRole('button', {name: 'prevCategory'}))
    expect(pressed('all')).toBe(false)
  })
})

describe('Catalog server accent', () => {
  it('ships the page-wide accent in the server HTML so it does not flash after hydration', () => {
    const html = renderToString(<Catalog initialServer="anarchy" />)
    expect(html).toContain(':root{--accent:#7b3ff2;--on-accent:#ffffff}')
  })
})

describe('Catalog per-server categories', () => {
  it('shows each server its own categories', async () => {
    render(<Catalog initialServer="survival" />)
    expect(screen.queryAllByRole('button', {name: 'cosmetics'})).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', {name: 'Minigames'}))
    // The old column animates out before the new one mounts.
    await waitFor(() => {
      expect(screen.queryAllByRole('button', {name: 'kits'})).toHaveLength(0)
    })
    expect(screen.getAllByRole('button', {name: 'cosmetics'}).length).toBeGreaterThan(0)
  })

  it('keeps the empty state for a category without products', () => {
    render(<Catalog initialServer="minigames" />)
    const [chip] = screen.getAllByRole('button', {name: 'cosmetics'})
    if (!chip) throw new Error('no cosmetics chip')
    fireEvent.click(chip)
    expect(screen.getByText('empty')).toBeTruthy()
  })
})

describe('Catalog first-view entrance', () => {
  const originalObserver = window.IntersectionObserver
  let intersect: () => void

  beforeEach(() => {
    window.IntersectionObserver = class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        intersect = () => {
          this.callback(
            [{target, isIntersecting: true, intersectionRatio: 1} as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          )
        }
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver
  })
  afterEach(() => {
    window.IntersectionObserver = originalObserver
  })

  it('holds the section back until it scrolls into view, then reveals it once', async () => {
    render(<Catalog initialServer="survival" />)
    const pill = screen.getByRole('button', {name: 'Anarchy'})
    expect(pill.style.opacity).toBe('0')
    act(() => {
      intersect()
    })
    await waitFor(
      () => {
        expect(pill.style.opacity).toBe('1')
      },
      {timeout: 3000}
    )
  })
})
