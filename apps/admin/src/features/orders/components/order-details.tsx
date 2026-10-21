'use client'

import {Card} from '@/components/card'
import {Hint} from '@/components/hint'
import {PageHeader} from '@/components/page-header'
import {Skeleton} from '@/components/skeleton'
import {StatusDot} from '@/components/status-dot'
import {useFormat} from '@/hooks/use-format'
import {useHoldLoading} from '@/hooks/use-hold-loading'
import {useGetAdminOrderQuery} from '@/lib/api/generated'
import {copyText} from '@/lib/copy'
import {Copy, ExternalLink} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Button} from '@shop/ui/button'

import {stripePaymentUrl} from '../lib/format'

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

export function OrderDetails({id}: {id: string}) {
  const t = useTranslations('orders.detail')
  const tc = useTranslations('common')
  const f = useFormat()
  const {data: order, isLoading, error} = useGetAdminOrderQuery({id})
  const held = useHoldLoading(isLoading)
  if (held) return <OrderDetailsLoading />
  if (!order)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('order')} back={{href: '/orders', label: t('back')}} />
        <p role="alert" className="rounded-card bg-card p-5">
          {(error as {status?: unknown} | undefined)?.status === 404
            ? t('notFound')
            : t('loadFailed')}
        </p>
      </div>
    )
  const money = (n: number) => f.money(n, order.currency)
  const stripeUrl = stripePaymentUrl(order.stripeSessionId, order.stripePaymentIntentId)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            {t('order')} <span className="font-mono">{order.publicId}</span>
          </>
        }
        back={{href: '/orders', label: t('back')}}
        actions={<StatusDot status={order.status} />}
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
                    <span className="tabular min-w-20 text-right font-semibold">
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
            <dt className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted">
              {t('discount')}
              {order.promoCode && ' '}
              {order.promoCode && (
                <span className="rounded-full bg-card-raised px-2 font-mono text-[12px] [overflow-wrap:anywhere] text-fg">
                  {order.promoCode}
                </span>
              )}
            </dt>
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
                      void copyText(order.email, t('emailLabel'), tc)
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
                  <span className="font-mono">{order.stripeSessionId}</span>
                ) : (
                  '—'
                )}
              </Row>
              <Row label={t('stripePayment')}>
                {stripeUrl ? (
                  <a
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-mono underline underline-offset-2 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    href={stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {order.stripePaymentIntentId}
                    </span>
                    <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                  </a>
                ) : (
                  (order.stripePaymentIntentId ?? '—')
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

/** The order page as it will be: header, the same cards and field labels, values as placeholders. */
export function OrderDetailsLoading() {
  const t = useTranslations('orders.detail')
  const tc = useTranslations('common')
  const value = (w = 'w-2/3') => <Skeleton className={`h-3.5 rounded-full ${w}`} />
  return (
    <div className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        {tc('loading')}
      </span>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t('order')} <Skeleton className="h-7 w-40 rounded-full" />
          </span>
        }
        back={{href: '/orders', label: t('back')}}
        actions={<Skeleton className="h-6 w-20 rounded-full" />}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title={t('items')}>
          <section aria-hidden className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded-full" />
            <ul className="flex flex-col gap-1.5">
              {Array.from({length: 2}, (_, i) => (
                <li key={i} className="skeleton h-[45px] rounded-plate" />
              ))}
            </ul>
          </section>
          <dl className="tabular ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-[13px]">
            <dt className="text-muted">{t('subtotal')}</dt>
            <dd>{value('w-16')}</dd>
            <dt className="text-muted">{t('discount')}</dt>
            <dd>{value('w-16')}</dd>
            <dt className="font-semibold">{t('total')}</dt>
            <dd>{value('w-20')}</dd>
          </dl>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t('buyer')}>
            <Fields>
              <Row label={t('nick')}>{value()}</Row>
              <Row label={t('email')}>{value('w-full')}</Row>
              <Row label={t('locale')}>{value('w-8')}</Row>
            </Fields>
          </Card>
          <Card title={t('payment')}>
            <Fields>
              <Row label={t('currency')}>{value('w-10')}</Row>
              <Row label={t('stripeSession')}>{value('w-full')}</Row>
              <Row label={t('stripePayment')}>{value('w-full')}</Row>
              <Row label={t('deliveryConsent')}>{value()}</Row>
            </Fields>
          </Card>
          <Card title={t('timeline')}>
            <ol aria-hidden className="flex flex-col gap-3 text-[13px]">
              {Array.from({length: 3}, (_, i) => (
                <li key={i} className="flex h-6 items-center gap-3">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-3.5 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-3.5 w-24 rounded-full" />
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
