import {requireMe} from '@/lib/session'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {BrandMark} from './_components/brand-mark'
import {LanguageSwitch} from './_components/language-switch'
import {Nav} from './_components/nav'
import {Rail} from './_components/rail'
import {TopBar} from './_components/top-bar'

export default async function ShellLayout({children}: {children: ReactNode}) {
  const me = await requireMe()
  const initial = (me.name || me.email).charAt(0).toUpperCase()
  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 p-4 md:grid-cols-[auto_1fr]">
      <Rail>
        <BrandMark />
        <Nav me={me} variant="rail" />
        <span className="mt-auto" />
        <LanguageSwitch orientation="vertical" />
        <Link
          href="/account"
          tabIndex={-1}
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-card-raised text-sm font-medium">
          {initial}
        </Link>
      </Rail>
      <div className="min-w-0">
        <TopBar me={me} />
        <main className="mx-auto w-full max-w-[1400px] pb-12">{children}</main>
      </div>
    </div>
  )
}
