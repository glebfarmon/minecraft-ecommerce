import {renderWithProviders} from '@/test/render-with-providers'
import {screen} from '@testing-library/react'

import {ServerCard} from './server-card'

const server = (productCount: number) => ({
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  productCount,
  rcon: null,
  rconPasswordSet: false
})

describe('ServerCard', () => {
  it.each([
    [1, 'en', '1 product'],
    [2, 'en', '2 products'],
    [1, 'pl', '1 produkt'],
    [2, 'pl', '2 produkty'],
    [5, 'pl', '5 produktów'],
    [22, 'pl', '22 produkty']
  ] as const)('says %i products in %s', (count, locale, text) => {
    renderWithProviders(<ServerCard server={server(count)} />, {locale, store: false})
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('says whether RCON is set, in Polish', () => {
    renderWithProviders(<ServerCard server={server(0)} />, {locale: 'pl', store: false})
    expect(screen.getByText('RCON nieustawiony')).toBeInTheDocument()
  })

  it('draws the selection ring with a numeric radius and a box-shadow Motion can correct', () => {
    const {container} = renderWithProviders(
      <ServerCard server={server(1)} selected onSelect={() => undefined} />,
      {locale: 'en', store: false}
    )
    const ring = container.querySelector('[data-slot="rolling-indicator"]') as HTMLElement
    expect(ring.style.borderRadius).toBe('24px')
    expect(ring.style.boxShadow).toContain('0 0 0 2px')
    expect(ring.className).not.toContain('ring-')
  })
})
