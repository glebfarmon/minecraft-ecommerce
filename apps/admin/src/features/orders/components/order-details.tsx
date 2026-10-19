'use client'

import {Card} from '@/components/card'
import {PageHeader} from '@/components/page-header'
import {SkeletonRows} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {useGetAdminOrderQuery} from '@/lib/api/generated'
import {formatMoney, formatTime} from '@/lib/format'
import {ArrowLeft, Copy} from 'lucide-react'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {Button} from '@shop/ui/button'

import {stripeSessionUrl} from '../lib/format'

function Fields({children}: {children: ReactNode}) {
  return <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-3 text-[13px]">{children}</dl>
}

function Row({label, children}: {label: string; children: ReactNode}) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">{children}</dd>
    </>
  )
}

function BackLink() {
  return (
    <Button asChild variant="ghost">
      <Link href="/orders">
        <ArrowLeft aria-hidden className="size-4" />
        Back to orders
      </Link>
    </Button>
  )
}

export function OrderDetails({id}: {id: string}) {
  const {data: order, isLoading, error} = useGetAdminOrderQuery({id})
  if (isLoading) return <SkeletonRows rows={6} />
  if (!order)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Order" actions={<BackLink />} />
        <p role="alert" className="rounded-card bg-card p-5">
          {(error as {status?: unknown} | undefined)?.status === 404
            ? 'Order not found.'
            : 'Could not load the order. Try again.'}
        </p>
      </div>
    )
  const money = (n: number) => formatMoney(n, order.currency)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            Order <span className="font-mono">{order.publicId}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <StatusDot status={order.status} />
            <BackLink />
          </div>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Items">
          {order.servers.map(s => (
            <section key={s.serverName} className="flex flex-col gap-1.5">
              <h3 className="label-caps">{s.serverName}</h3>
              <ul className="flex flex-col gap-1.5">
                {s.items.map((item, i) => (
                  <li
                    key={`${String(i)}-${item.productName}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-plate bg-card-raised px-4 py-3 text-[13px]">
                    <span className="min-w-0 flex-1 font-medium">{item.productName}</span>
                    <span className="tabular text-muted">
                      × {item.quantity} · {money(item.unitAmountMinor)} each
                    </span>
                    <span className="tabular w-20 text-right font-semibold">
                      {money(item.unitAmountMinor * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <dl className="tabular ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-border pt-4 text-[13px]">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right">{money(order.subtotalMinor)}</dd>
            <dt className="text-muted">Discount</dt>
            <dd className="text-right">{money(order.discountMinor)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right text-[15px] font-semibold">{money(order.totalMinor)}</dd>
          </dl>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Buyer">
            <Fields>
              <Row label="Nick">{order.nick}</Row>
              <Row label="Email">
                <span>{order.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy email"
                  className="size-7 shrink-0"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.email)
                  }}>
                  <Copy aria-hidden className="size-3.5" />
                </Button>
              </Row>
              <Row label="Locale">{order.locale}</Row>
            </Fields>
          </Card>
          <Card title="Payment">
            <Fields>
              <Row label="Currency">{order.currency}</Row>
              <Row label="Stripe session">
                {order.stripeSessionId ? (
                  <a
                    className="font-mono underline"
                    href={stripeSessionUrl(order.stripeSessionId)}
                    target="_blank"
                    rel="noopener noreferrer">
                    {order.stripeSessionId}
                  </a>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="Delivery consent">{formatTime(order.deliveryConsentAt)}</Row>
            </Fields>
          </Card>
          <Card title="Timeline">
            <ol className="flex flex-col gap-3 text-[13px]">
              <li className="flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-idle" />
                <span className="flex-1">Created</span>
                <span className="tabular text-muted">{formatTime(order.createdAt)}</span>
              </li>
              {order.paidAt && (
                <li className="flex items-center gap-3">
                  <span aria-hidden className="size-2 rounded-full bg-ok" />
                  <span className="flex-1">Paid</span>
                  <span className="tabular text-muted">{formatTime(order.paidAt)}</span>
                </li>
              )}
              <li className="flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-fg" />
                <span className="flex-1">Now</span>
                <StatusDot status={order.status} />
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
