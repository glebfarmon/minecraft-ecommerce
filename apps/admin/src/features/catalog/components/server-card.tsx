import {Hint} from '@/components/hint'
import {RollingIndicator} from '@/components/rolling-indicator'
import type {ListCatalogServersApiResponse} from '@/lib/api/generated'
import {Pencil} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

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
const ICON =
  'grid size-7 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

/**
 * Without `onSelect` (the editor's live preview) the card is not a tab. A click selects the
 * server; `editHref` adds the pencil that opens its editor. Render inside a `LayoutGroup` so the
 * selection ring rolls between cards.
 */
export function ServerCard({
  server,
  selected = false,
  onSelect,
  handle,
  editHref
}: {
  server: Pick<
    Server,
    'name' | 'accent' | 'onAccent' | 'isActive' | 'productCount' | 'rcon' | 'rconPasswordSet'
  >
  selected?: boolean
  onSelect?: () => void
  handle?: DragHandleProps
  editHref?: string
}) {
  const t = useTranslations('catalog')
  const rconReady = server.rconPasswordSet && Boolean(server.rcon?.host)
  const style = {background: server.accent, color: server.onAccent}
  const body = (
    <>
      <span className="text-[16px] font-semibold">{server.name}</span>
      <span className="tabular text-[13px]">
        {t('productsCount', {count: server.productCount})}
      </span>
      <span className="flex flex-wrap gap-1.5">
        <Pill>{rconReady ? t('rconReady') : t('rconNotSet')}</Pill>
        {!server.isActive && <Pill>{t('disabled')}</Pill>}
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
    <div className="relative isolate">
      {selected && (
        <RollingIndicator
          className="-inset-1 ring-2 ring-fg"
          style={{borderRadius: 'calc(var(--radius-card) + 4px)'}}
        />
      )}
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onSelect}
        style={style}
        className={cn(
          CARD,
          editHref && 'pr-20',
          'ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
        )}>
        {body}
      </button>
      {editHref && (
        <Hint label={t('editServer')}>
          <Link
            href={editHref}
            aria-label={t('editName', {name: server.name})}
            className={cn(ICON, 'absolute top-3 right-11 hover:bg-black/10')}
            style={{color: server.onAccent}}>
            <Pencil aria-hidden className="size-4" />
          </Link>
        </Hint>
      )}
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
