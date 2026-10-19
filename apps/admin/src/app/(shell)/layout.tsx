import {requireMe} from '@/lib/session'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {Nav} from './_components/nav'
import {TopBar} from './_components/top-bar'

export default async function ShellLayout({children}: {children: ReactNode}) {
  const me = await requireMe()
  const initial = (me.name || me.email).charAt(0).toUpperCase()
  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 p-4 md:grid-cols-[auto_1fr]">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[72px] flex-col items-center gap-2 rounded-full bg-surface py-4 md:flex">
        <span
          aria-hidden
          className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent font-semibold text-on-accent">
          S
        </span>
        <Nav me={me} variant="rail" />
        <span className="mt-auto" />
        <Link
          href="/account"
          tabIndex={-1}
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-card-raised text-sm font-medium">
          {initial}
        </Link>
      </aside>
      <div className="min-w-0">
        <TopBar me={me} />
        <main className="mx-auto w-full max-w-[1400px] pb-12">{children}</main>
      </div>
    </div>
  )
}
