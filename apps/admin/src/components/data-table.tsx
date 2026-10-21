'use client'

import {useTranslations} from 'next-intl'
import Link from 'next/link'
import type {MouseEvent, ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {RowMenu, type RowMenuItem} from './row-menu'
import {Skeleton} from './skeleton'

export type Column<T> = {
  header: string
  cell: (r: T) => ReactNode
  className?: string
  primary?: boolean
  /** The placeholder's shape while loading; a text line by default. A status pill is `h-6 w-20 rounded-full`. */
  placeholder?: string
}

/** Placeholder rows go from long to short and back, so they read as rows of text, not a grid. */
const WIDTHS = ['w-3/5', 'w-4/5', 'w-1/2', 'w-2/3', 'w-3/4']
const placeholderOf = (c: {placeholder?: string; className?: string}, i: number) => (
  <Skeleton
    className={cn(
      c.placeholder ?? cn('h-3.5 rounded-full', WIDTHS[i % WIDTHS.length]),
      // A right-aligned column (money) keeps its placeholder on the right.
      c.className?.includes('text-right') && 'ml-auto'
    )}
  />
)

export function DataTable<T>({
  caption,
  rows,
  rowKey,
  rowLabel,
  columns,
  menu,
  empty,
  rowHref,
  onRowClick,
  loading
}: {
  caption: string
  rows: T[]
  rowKey: (r: T) => string
  /** Names the row's menu button when the primary cell is not plain text (e.g. a link). */
  rowLabel?: (r: T) => string
  columns: Column<T>[]
  menu?: (r: T) => RowMenuItem[]
  empty?: ReactNode
  /** The whole row opens this page; the primary cell becomes its link (keyboard, ⌘-click). */
  rowHref?: (r: T) => string
  /** The whole row runs this instead, for rows whose detail opens in place. */
  onRowClick?: (r: T) => void
  /** Rows still loading: this many rows of the same table, headers included, with placeholders. */
  loading?: number
}) {
  const t = useTranslations('table')
  const common = useTranslations('common')
  if (loading)
    return (
      <Loading
        caption={caption}
        columns={columns}
        rows={loading}
        menu={Boolean(menu)}
        label={common('loading')}
      />
    )
  if (rows.length === 0) return <>{empty}</>
  const primary = columns.find(c => c.primary) ?? columns[0]
  const clickable = Boolean(rowHref ?? onRowClick)
  const primaryCell = (r: T) =>
    rowHref ? (
      <Link
        href={rowHref(r)}
        data-row-link
        className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
        {primary?.cell(r)}
      </Link>
    ) : (
      primary?.cell(r)
    )
  const cellOf = (c: Column<T>, r: T) => (c === primary ? primaryCell(r) : c.cell(r))
  /** Ignores clicks meant for something inside the row, modified clicks and text selection. */
  const onClick = (r: T) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    // React bubbles events out of portals (menus, selects); only clicks really inside the row count.
    if (!e.currentTarget.contains(e.target as Node)) return
    if ((e.target as Element).closest('a, button, input, textarea, [role=menuitem]')) return
    if (window.getSelection()?.toString()) return
    // The row's own link does the navigation, so it stays a client-side transition.
    if (rowHref) e.currentTarget.querySelector<HTMLAnchorElement>('a[data-row-link]')?.click()
    else onRowClick?.(r)
  }
  const menuLabel = (r: T) => {
    if (rowLabel) return t('actionsFor', {label: rowLabel(r)})
    const v = primary?.cell(r)
    return typeof v === 'string' ? t('actionsFor', {label: v}) : t('actions')
  }
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-y-1.5 md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.header} scope="col" className="label-caps px-4 pb-1 text-left">
                {c.header}
              </th>
            ))}
            {menu && (
              <th scope="col" className="w-12">
                <span className="sr-only">{t('actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={rowKey(r)}
              className={cn('group', clickable && 'cursor-pointer')}
              onClick={clickable ? onClick(r) : undefined}>
              {columns.map((c, i) => (
                <td
                  key={c.header}
                  className={cn(
                    'bg-card px-4 py-3 text-[13px] transition-colors group-hover:bg-card-raised',
                    i === 0 && 'rounded-l-plate',
                    i === columns.length - 1 && !menu && 'rounded-r-plate',
                    c.className
                  )}>
                  <div className="max-w-[16rem] truncate">{cellOf(c, r)}</div>
                </td>
              ))}
              {menu && (
                <td className="rounded-r-plate bg-card px-2 text-right group-hover:bg-card-raised">
                  <RowActions label={menuLabel(r)} items={menu(r)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map(r => (
          <li
            key={rowKey(r)}
            className={cn(
              'flex items-start gap-3 rounded-plate bg-card p-4',
              clickable && 'cursor-pointer transition-colors hover:bg-card-raised'
            )}
            onClick={clickable ? onClick(r) : undefined}>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="font-semibold [overflow-wrap:anywhere]">
                {primary && primaryCell(r)}
              </div>
              {columns
                .filter(c => c !== primary)
                .map(c => (
                  <div key={c.header} className="flex gap-2 text-[13px]">
                    <span className="w-20 shrink-0 text-muted">{c.header}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{c.cell(r)}</span>
                  </div>
                ))}
            </div>
            {menu && <RowActions label={menuLabel(r)} items={menu(r)} />}
          </li>
        ))}
      </ul>
    </>
  )
}

/** A row with nothing to do (e.g. the owner) gets no menu button at all. */
function RowActions({label, items}: {label: string; items: RowMenuItem[]}) {
  return items.length > 0 ? <RowMenu label={label} items={items} /> : null
}

/** The table and the phone list of `DataTable`, with placeholders where the cells go. */
function Loading<T>({
  caption,
  columns,
  rows,
  menu,
  label
}: {
  caption: string
  columns: Column<T>[]
  rows: number
  menu: boolean
  label: string
}) {
  const primary = columns.find(c => c.primary) ?? columns[0]
  const keys = Array.from({length: rows}, (_, i) => i)
  return (
    <div role="status" aria-label={caption}>
      <span className="sr-only">{label}</span>
      <table aria-hidden className="hidden w-full border-separate border-spacing-y-1.5 md:table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.header} scope="col" className="label-caps px-4 pb-1 text-left">
                {c.header}
              </th>
            ))}
            {menu && <th className="w-12" />}
          </tr>
        </thead>
        <tbody>
          {keys.map(r => (
            <tr key={r}>
              {columns.map((c, i) => (
                <td
                  key={c.header}
                  className={cn(
                    'h-12 bg-card px-4 py-3',
                    i === 0 && 'rounded-l-plate',
                    i === columns.length - 1 && !menu && 'rounded-r-plate'
                  )}>
                  {placeholderOf(c, r + i)}
                </td>
              ))}
              {menu && (
                <td className="rounded-r-plate bg-card px-2">
                  <Skeleton className="ml-auto size-9 rounded-full" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-hidden className="flex flex-col gap-2 md:hidden">
        {keys.map(r => (
          <li key={r} className="flex items-start gap-3 rounded-plate bg-card p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className={cn('my-1 h-4 rounded-full', WIDTHS[r % WIDTHS.length])} />
              {columns
                .filter(c => c !== primary)
                .map((c, i) => (
                  <div key={c.header} className="flex items-center gap-2 text-[13px]">
                    <span className="w-20 shrink-0 text-muted">{c.header}</span>
                    {placeholderOf(c, r + i + 1)}
                  </div>
                ))}
            </div>
            {menu && <Skeleton className="size-9 shrink-0 rounded-full" />}
          </li>
        ))}
      </ul>
    </div>
  )
}
