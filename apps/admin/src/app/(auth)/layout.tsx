import type {ReactNode} from 'react'

export default function AuthLayout({children}: {children: ReactNode}) {
  return <main className="min-h-screen px-4">{children}</main>
}
