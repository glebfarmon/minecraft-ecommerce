import type {ReactNode} from 'react'

import {LanguageSwitch} from '../(shell)/_components/language-switch'

export default function AuthLayout({children}: {children: ReactNode}) {
  return (
    <main className="min-h-screen px-4">
      <div className="flex justify-end pt-4">
        <LanguageSwitch orientation="horizontal" />
      </div>
      {children}
    </main>
  )
}
