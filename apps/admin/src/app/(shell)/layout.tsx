import {requireMe} from '@/lib/session'
import type {ReactNode} from 'react'

import {Nav} from './_components/nav'

export default async function ShellLayout({children}: {children: ReactNode}) {
  const me = await requireMe()
  return (
    <div className="grid min-h-screen grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-6 border-r p-4">
        <p className="text-sm font-semibold">Shop Admin</p>
        <Nav me={me} />
        <p className="text-muted-foreground mt-auto text-xs">
          {me.email} · {me.role.name}
        </p>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  )
}
