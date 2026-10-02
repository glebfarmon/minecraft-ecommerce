import {Navbar} from '@/app/[locale]/_components/navbar'
import {ShopProvider} from '@/features/cart/shop-provider'
import {StatusProvider} from '@/features/status/status-provider'
import {routing} from '@/i18n/routing'
import type {Metadata} from 'next'
import {NextIntlClientProvider, hasLocale} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {Inter_Tight, JetBrains_Mono, Oswald} from 'next/font/google'
import {notFound} from 'next/navigation'
import type {ReactNode} from 'react'

import '../globals.css'

const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter-tight',
  display: 'swap'
})
const oswald = Oswald({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-oswald',
  display: 'swap'
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains-mono',
  display: 'swap'
})

// Daily regeneration keeps the footer year current on otherwise static pages.
export const revalidate = 86_400

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  const t = await getTranslations({locale, namespace: 'meta'})
  return {title: t('title'), description: t('description')}
}

export default async function LocaleLayout({
  children,
  modal,
  params
}: {
  children: ReactNode
  modal: ReactNode
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  return (
    <html
      lang={locale}
      className={`${interTight.variable} ${oswald.variable} ${jetbrainsMono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <StatusProvider>
            <ShopProvider>
              <Navbar />
              {children}
              {modal}
            </ShopProvider>
          </StatusProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
