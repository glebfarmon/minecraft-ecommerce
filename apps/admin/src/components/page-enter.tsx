import type {ReactNode} from 'react'

/**
 * Wraps a route's `loading.tsx`, so its blocks rise in (see `.page-enter`). Only the loading state
 * animates: the page that replaces it swaps in place, without a second entry.
 */
export function PageEnter({children}: {children: ReactNode}) {
  return <div className="page-enter contents">{children}</div>
}
