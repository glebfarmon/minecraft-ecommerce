'use client'

import {StatusDot} from '@/components/status-dot'
import {useGetAdminOrderQuery} from '@/lib/api/generated'
import {formatMoney, formatTime} from '@/lib/format'

import {stripeSessionUrl} from '../lib/format'

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

export function OrderDetails({id}: {id: string}) {
  const {data: order, isLoading, error} = useGetAdminOrderQuery({id})
  if (isLoading) return <p>Loading…</p>
  if (!order)
    return (
      <p role="alert">
        {(error as {status?: unknown} | undefined)?.status === 404
          ? 'Order not found.'
          : 'Could not load the order. Try again.'}
      </p>
    )
  const money = (n: number) => formatMoney(n, order.currency)
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid max-w-xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2">
        <Row label="Order">{order.publicId}</Row>
        <Row label="Status">
          <StatusDot status={order.status} />
        </Row>
        <Row label="Nick">{order.nick}</Row>
        <Row label="Email">{order.email}</Row>
        <Row label="Created">{formatTime(order.createdAt)}</Row>
        <Row label="Paid">{order.paidAt ? formatTime(order.paidAt) : '—'}</Row>
        <Row label="Delivery consent">{formatTime(order.deliveryConsentAt)}</Row>
        <Row label="Locale">{order.locale}</Row>
        <Row label="Stripe session">
          {order.stripeSessionId ? (
            <a
              className="underline"
              href={stripeSessionUrl(order.stripeSessionId)}
              target="_blank"
              rel="noopener noreferrer">
              {order.stripeSessionId}
            </a>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Subtotal">{money(order.subtotalMinor)}</Row>
        <Row label="Discount">{money(order.discountMinor)}</Row>
        <Row label="Total">{money(order.totalMinor)}</Row>
      </dl>
      {order.servers.map(s => (
        <section key={s.serverName} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.serverName}</h2>
          <ul className="flex flex-col gap-1">
            {s.items.map((item, i) => (
              <li key={`${String(i)}-${item.productName}`}>
                {item.productName} × {item.quantity} — {money(item.unitAmountMinor)} each
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
