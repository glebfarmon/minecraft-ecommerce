import type {ReactNode} from 'react'

/** Remounts on every navigation, so each page's blocks rise in (see `.page-enter`). */
export default function ShellTemplate({children}: {children: ReactNode}) {
  return <div className="page-enter">{children}</div>
}
