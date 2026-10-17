'use client'

import {createContext, useContext} from 'react'
import type {ReactNode} from 'react'

const TurnstileKeyContext = createContext<string | null>(null)

/** The layout reads the site key at request time (never `NEXT_PUBLIC_*`, so one image serves every environment). */
export function TurnstileKeyProvider({siteKey, children}: {siteKey: string; children: ReactNode}) {
  return <TurnstileKeyContext value={siteKey}>{children}</TurnstileKeyContext>
}

export function useTurnstileKey(): string {
  const key = useContext(TurnstileKeyContext)
  if (key === null) throw new Error('useTurnstileKey must be used inside <TurnstileKeyProvider>')
  return key
}
