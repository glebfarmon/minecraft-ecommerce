'use client'

import {Card} from '@/components/card'
import {Hint} from '@/components/hint'
import {PageHeader} from '@/components/page-header'
import {SkeletonRows} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {useFormat} from '@/hooks/use-format'
import {useGetAdminOrderQuery} from '@/lib/api/generated'
import {ArrowLeft, Copy} from 'lucide-react'
import {useTranslations} from 'next-intl'
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
  const t = useTranslations('orders.detail')
  return (
    <Button asChild variant="ghost">
      <Link href="/orders">
        <ArrowLeft aria-hidden className="size-4" />
        {t('back')}
      </Link>
    </Button>
  )
}

export function OrderDetails({id}: {id: string}) {
  const t = useTranslations('orders.detail')
  const f = useFormat()
  const {data: order, isLoading, error} = useGetAdminOrderQuery({id})
  if (isLoading) return <SkeletonRows rows={6} />
  if (!order)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('order')} actions={<BackLink />} />
        <p role="alert" className="rounded-card bg-card p-5">
          {(error as {status?: unknown} | undefined)?.status === 404
            ? t('notFound')
            : t('loadFailed')}
        </p>
      </div>
    )
  const money = (n: number) => f.money(n, order.currency)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            {t('order')} <span className="font-mono">{order.publicId}</span>
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
        <Card title={t('items')}>
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
                      {t('each', {quantity: item.quantity, price: money(item.unitAmountMinor)})}
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
            <dt className="text-muted">{t('subtotal')}</dt>
            <dd className="text-right">{money(order.subtotalMinor)}</dd>
            <dt className="text-muted">{t('discount')}</dt>
            <dd className="text-right">{money(order.discountMinor)}</dd>
            <dt className="font-semibold">{t('total')}</dt>
            <dd className="text-right text-[15px] font-semibold">{money(order.totalMinor)}</dd>
          </dl>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t('buyer')}>
            <Fields>
              <Row label={t('nick')}>{order.nick}</Row>
              <Row label={t('email')}>
                <span>{order.email}</span>
                <Hint label={t('copyEmail')}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('copyEmail')}
                    className="size-7 shrink-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(order.email)
                    }}>
                    <Copy aria-hidden className="size-3.5" />
                  </Button>
                </Hint>
              </Row>
              <Row label={t('locale')}>{order.locale}</Row>
            </Fields>
          </Card>
          <Card title={t('payment')}>
            <Fields>
              <Row label={t('currency')}>{order.currency}</Row>
              <Row label={t('stripeSession')}>
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
              <Row label={t('deliveryConsent')}>{f.time(order.deliveryConsentAt)}</Row>
            </Fields>
          </Card>
          <Card title={t('timeline')}>
            <ol className="flex flex-col gap-3 text-[13px]">
              <li className="flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-idle" />
                <span className="flex-1">{t('created')}</span>
                <span className="tabular text-muted">{f.time(order.createdAt)}</span>
              </li>
              {order.paidAt && (
                <li className="flex items-center gap-3">
                  <span aria-hidden className="size-2 rounded-full bg-ok" />
                  <span className="flex-1">{t('paid')}</span>
                  <span className="tabular text-muted">{f.time(order.paidAt)}</span>
                </li>
              )}
              <li className="flex items-center gap-3">
                <span aria-hidden className="size-2 rounded-full bg-fg" />
                <span className="flex-1">{t('now')}</span>
                <StatusDot status={order.status} />
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
