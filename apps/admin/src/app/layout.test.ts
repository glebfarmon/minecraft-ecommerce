import type {ReactElement} from 'react'

import RootLayout, {generateMetadata} from './layout'

const fetchMock = jest.fn()
jest.mock('next-intl/server', () => ({getLocale: () => Promise.resolve('pl')}))
jest.mock('next-intl', () => ({NextIntlClientProvider: () => null}))
jest.mock('next/font/google', () => ({
  Inter_Tight: () => ({variable: 'font-inter-tight'}),
  JetBrains_Mono: () => ({variable: 'font-jetbrains-mono'})
}))

describe('admin layout metadata', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('keeps the whole admin out of search engines', async () => {
    fetchMock.mockResolvedValue({ok: false})
    expect((await generateMetadata()).robots).toEqual({index: false, follow: false})
  })

  it('titles the admin with the default site name', async () => {
    fetchMock.mockResolvedValue({ok: false})
    expect((await generateMetadata()).title).toBe('Blockhaus Admin')
  })

  it('titles the admin with the site name from Content → Settings', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({siteName: {plain: 'Craft', accent: 'Land'}})
    })
    expect((await generateMetadata()).title).toBe('CraftLand Admin')
  })
})

describe('admin layout fonts', () => {
  it('puts the Inter Tight and JetBrains Mono variables on <html>', async () => {
    const html = (await RootLayout({children: null})) as ReactElement<{className: string}>
    expect(html.type).toBe('html')
    expect(html.props.className).toContain('font-inter-tight')
    expect(html.props.className).toContain('font-jetbrains-mono')
  })

  it('sets <html lang> from the locale cookie', async () => {
    const html = (await RootLayout({children: null})) as ReactElement<{lang: string}>
    expect(html.props.lang).toBe('pl')
  })
})
