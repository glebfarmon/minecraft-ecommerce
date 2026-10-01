import {Navbar} from '@/app/[locale]/_components/navbar'
import {ShopProvider} from '@/components/shop-provider'
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
  weight: ['400', '500', '700', '800'],
  variable: '--font-inter-tight',
  display: 'swap'
})
const oswald = Oswald({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  variable: '--font-oswald',
  display: 'swap'
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['500'],
  variable: '--font-jetbrains-mono',
  display: 'swap'
})

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
          <ShopProvider>
            <Navbar />
            {children}
            {modal}
          </ShopProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
