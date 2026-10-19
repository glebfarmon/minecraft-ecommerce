import type {Metadata} from 'next'
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

export const metadata: Metadata = {
  title: 'Shop Admin',
  robots: {index: false, follow: false}
}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en" className={`${interTight.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
