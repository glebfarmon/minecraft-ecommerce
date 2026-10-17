'use client'

import {StatusDot} from '@/components/status-dot'
import {type ListAdminOrdersApiArg, useListAdminOrdersQuery} from '@/lib/api/generated'
import {formatMoney, formatTime} from '@/lib/format'
import Link from 'next/link'
import {useState} from 'react'

import {ORDER_STATUSES} from '@shop/shared/orders'
import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

type Query = Omit<ListAdminOrdersApiArg, 'cursor'>

function PageRows({
  query,
  cursor,
  isFirst,
  isLast,
  onMore
}: {
  query: Query
  cursor: string | undefined
  isFirst: boolean
  isLast: boolean
  onMore: (cursor: string) => void
}) {
  const page = useListAdminOrdersQuery({...query, cursor})
  if (page.isLoading)
    return (
      <TableRow>
        <TableCell colSpan={6}>Loading…</TableCell>
      </TableRow>
    )
  if (page.isError || !page.data)
    return (
      <TableRow>
        <TableCell colSpan={6} role="alert">
          {(page.error as {status?: unknown} | undefined)?.status === 403
            ? 'You do not have permission to read orders.'
            : 'Could not load orders. Try again.'}
        </TableCell>
      </TableRow>
    )
  const next = page.data.nextCursor
  return (
    <>
      {isFirst && page.data.orders.length === 0 && (
        <TableRow>
          <TableCell colSpan={6}>No orders found.</TableCell>
        </TableRow>
      )}
      {page.data.orders.map(o => (
        <TableRow key={o.id}>
          <TableCell>{formatTime(o.createdAt)}</TableCell>
          <TableCell>
            <Link href={`/orders/${o.id}`} className="underline">
              {o.publicId}
            </Link>
          </TableCell>
          <TableCell>{o.nick}</TableCell>
          <TableCell>{o.email}</TableCell>
          <TableCell>{formatMoney(o.totalMinor, o.currency)}</TableCell>
          <TableCell>
            <StatusDot status={o.status} />
          </TableCell>
        </TableRow>
      ))}
      {isLast && next && (
        <TableRow>
          <TableCell colSpan={6}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onMore(next)
              }}>
              Load more
            </Button>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function OrdersTable() {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Query['status']>(undefined)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const query: Query = {q: q.trim() || undefined, status}

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={e => {
          e.preventDefault()
          setQ(draft)
          setCursors([undefined])
        }}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="orders-q">Search by nick, email or order number</Label>
          <Input
            id="orders-q"
            value={draft}
            onChange={e => {
              setDraft(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="orders-status">Status</Label>
          <Select
            id="orders-status"
            value={status ?? ''}
            onChange={e => {
              setStatus((e.target.value || undefined) as Query['status'])
              setCursors([undefined])
            }}>
            <option value="">All</option>
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Search</Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Nick</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cursors.map((cursor, i) => (
            <PageRows
              key={cursor ?? 'first'}
              query={query}
              cursor={cursor}
              isFirst={i === 0}
              isLast={i === cursors.length - 1}
              onMore={next => {
                setCursors(c => [...c, next])
              }}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
