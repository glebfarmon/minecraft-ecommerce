'use client'

import type {ReactNode} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {RowMenu, type RowMenuItem} from './row-menu'

export type Column<T> = {
  header: string
  cell: (r: T) => ReactNode
  className?: string
  primary?: boolean
}

export function DataTable<T>({
  caption,
  rows,
  rowKey,
  rowLabel,
  columns,
  menu,
  empty
}: {
  caption: string
  rows: T[]
  rowKey: (r: T) => string
  /** Names the row's menu button when the primary cell is not plain text (e.g. a link). */
  rowLabel?: (r: T) => string
  columns: Column<T>[]
  menu?: (r: T) => RowMenuItem[]
  empty?: ReactNode
}) {
  if (rows.length === 0) return <>{empty}</>
  const primary = columns.find(c => c.primary) ?? columns[0]
  const menuLabel = (r: T) => {
    if (rowLabel) return `Actions for ${rowLabel(r)}`
    const v = primary?.cell(r)
    return typeof v === 'string' ? `Actions for ${v}` : 'Actions'
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
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className="group">
              {columns.map((c, i) => (
                <td
                  key={c.header}
                  className={cn(
                    'bg-card px-4 py-3 text-[13px] transition-colors group-hover:bg-card-raised',
                    i === 0 && 'rounded-l-plate',
                    i === columns.length - 1 && !menu && 'rounded-r-plate',
                    c.className
                  )}>
                  <div className="max-w-[16rem] truncate">{c.cell(r)}</div>
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
          <li key={rowKey(r)} className="flex items-start gap-3 rounded-plate bg-card p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="font-semibold break-all">{primary?.cell(r)}</div>
              {columns
                .filter(c => c !== primary)
                .map(c => (
                  <div key={c.header} className="flex gap-2 text-[13px]">
                    <span className="w-20 shrink-0 text-muted">{c.header}</span>
                    <span className="min-w-0 break-all">{c.cell(r)}</span>
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
