import {getSiteTitle} from '@/lib/site-name'
import type {Metadata} from 'next'
import {NextIntlClientProvider} from 'next-intl'
import {getLocale} from 'next-intl/server'
import {Inter_Tight, JetBrains_Mono} from 'next/font/google'
import type {ReactNode} from 'react'

import './globals.css'
import {Providers} from './providers'

const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap'
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['500'],
  variable: '--font-jetbrains-mono',
  display: 'swap'
})

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${await getSiteTitle()} Admin`,
    robots: {index: false, follow: false}
  }
}

export default async function RootLayout({children}: {children: ReactNode}) {
  const locale = await getLocale()
  return (
    <html lang={locale} className={`${interTight.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
