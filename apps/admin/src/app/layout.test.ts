import type {ReactElement} from 'react'

import RootLayout, {metadata} from './layout'

jest.mock('next-intl/server', () => ({getLocale: () => Promise.resolve('pl')}))
jest.mock('next-intl', () => ({NextIntlClientProvider: () => null}))
jest.mock('next/font/google', () => ({
  Inter_Tight: () => ({variable: 'font-inter-tight'}),
  JetBrains_Mono: () => ({variable: 'font-jetbrains-mono'})
}))

describe('admin layout metadata', () => {
  it('keeps the whole admin out of search engines', () => {
    expect(metadata.robots).toEqual({index: false, follow: false})
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
