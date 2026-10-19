import type {ListCatalogServersApiResponse} from '@/lib/api/generated'
import type {ReactNode} from 'react'

import {DragHandle} from './drag-handle'
import type {DragHandleProps} from './sortable-list'

type Server = ListCatalogServersApiResponse[number]

/** A label on a translucent ground of the server's text colour, so it reads on any accent. */
function Pill({children}: {children: ReactNode}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{background: 'color-mix(in oklab, currentColor 14%, transparent)'}}>
      {children}
    </span>
  )
}

const CARD = 'flex min-w-56 flex-col items-start gap-3 rounded-card p-4 pr-12 text-left'

/** Without `onSelect` (the editor's live preview) the card is not a tab. */
export function ServerCard({
  server,
  selected = false,
  onSelect,
  handle
}: {
  server: Pick<
    Server,
    'name' | 'accent' | 'onAccent' | 'isActive' | 'productCount' | 'rcon' | 'rconPasswordSet'
  >
  selected?: boolean
  onSelect?: () => void
  handle?: DragHandleProps
}) {
  const rconReady = server.rconPasswordSet && Boolean(server.rcon?.host)
  const style = {background: server.accent, color: server.onAccent}
  const body = (
    <>
      <span className="text-[16px] font-semibold">{server.name}</span>
      <span className="tabular text-[13px]">
        {server.productCount} {server.productCount === 1 ? 'product' : 'products'}
      </span>
      <span className="flex flex-wrap gap-1.5">
        <Pill>{rconReady ? 'RCON ready' : 'RCON not set'}</Pill>
        {!server.isActive && <Pill>Disabled</Pill>}
      </span>
    </>
  )
  if (!onSelect)
    return (
      <div style={style} className={CARD}>
        {body}
      </div>
    )
  return (
    <div className="relative">
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onSelect}
        style={style}
        className={`${CARD} ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-selected:ring-2 aria-selected:ring-fg`}>
        {body}
      </button>
      {handle && (
        <DragHandle
          label={server.name}
          handle={handle}
          className="absolute top-3 right-3 hover:bg-transparent"
          style={{color: server.onAccent}}
        />
      )}
    </div>
  )
}
