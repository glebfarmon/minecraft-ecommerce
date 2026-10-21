'use client'

import {ORDER_POLL_LIMIT_MS, ORDER_POLL_MS, PENDING_ORDER_KEY} from '@/config/order'
import {clearCart} from '@/features/order/lib/clear-cart'
import {Link} from '@/i18n/navigation'
import {formatPrice} from '@/lib/catalog'
import {useLocale, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useEffect, useRef, useState} from 'react'
import * as v from 'valibot'

import {type PublicOrder, PublicOrderSchema} from '@shop/shared/orders'

/** Shows the order and, while it is `PENDING`, asks the API every `ORDER_POLL_MS` until it is paid or `ORDER_POLL_LIMIT_MS` has passed. */
export function OrderStatus({initial}: {initial: PublicOrder}) {
  const t = useTranslations('order')
  const locale = useLocale()
  const router = useRouter()
  const [order, setOrder] = useState(initial)
  const [slow, setSlow] = useState(false)
  const cleared = useRef(false)
  const {publicId, status} = order

  const paid = status === 'PAID' || status === 'DELIVERED'

  useEffect(() => {
    if (!paid || cleared.current) return
    cleared.current = true
    // Only the order this browser just sent to the payment page spends the cart; an old link must not.
    try {
      if (localStorage.getItem(PENDING_ORDER_KEY) !== publicId) return
      localStorage.removeItem(PENDING_ORDER_KEY)
    } catch {
      return
    }
    clearCart()
    router.refresh()
  }, [paid, publicId, router])

  useEffect(() => {
    if (status !== 'PENDING') return
    const controller = new AbortController()
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started >= ORDER_POLL_LIMIT_MS) {
        clearInterval(timer)
        setSlow(true)
        return
      }
      fetch(`/api/orders/${publicId}`, {cache: 'no-store', signal: controller.signal})
        .then(res => (res.ok ? res.json() : null))
        .then((body: unknown) => {
          const next = v.safeParse(PublicOrderSchema, body)
          if (next.success && next.output.status !== 'PENDING') setOrder(next.output)
        })
        .catch(() => undefined)
    }, ORDER_POLL_MS)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [status, publicId])

  return (
    <div>
      <div aria-live="polite">
        {paid && (
          <>
            <h2 className="font-display text-3xl uppercase">{t('paid.title')}</h2>
            <p className="mt-3 text-muted">{t('paid.body', {email: order.email})}</p>
          </>
        )}
        {status === 'PENDING' && (
          <>
            <h2 className="font-display text-3xl uppercase">{t('pending.title')}</h2>
            {slow && <p className="mt-3 text-muted">{t('pending.slow')}</p>}
          </>
        )}
        {status === 'EXPIRED' && (
          <>
            <h2 className="font-display text-3xl uppercase">{t('expired.title')}</h2>
            <Link href="/" className="mt-4 inline-block underline">
              {t('expired.back')}
            </Link>
          </>
        )}
        {(status === 'REFUNDED' || status === 'DISPUTED') && (
          <>
            <h2 className="font-display text-3xl uppercase">{t('closed.title')}</h2>
            <p className="mt-3 text-muted">{t('closed.body')}</p>
          </>
        )}
      </div>

      <div className="mt-10 space-y-8">
        {order.servers.map((server, i) => (
          <section key={`${String(i)}-${server.serverName}`}>
            <h3 className="font-display text-xl uppercase">{server.serverName}</h3>
            <ul className="mt-3 divide-y divide-line">
              {server.items.map((item, j) => (
                <li
                  key={`${String(j)}-${item.productName}`}
                  className="flex justify-between gap-4 py-2">
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span>
                    {formatPrice(item.unitAmountMinor * item.quantity, order.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {order.discountMinor > 0 && order.promoCode && (
          <p className="flex justify-between border-t border-line pt-4">
            <span>{t('promo', {code: order.promoCode})}</span>
            <span>{`\u2212${formatPrice(order.discountMinor, order.currency, locale)}`}</span>
          </p>
        )}
        <p className="flex justify-between border-t border-line pt-4 text-lg font-semibold">
          <span>{t('total')}</span>
          <span>{formatPrice(order.totalMinor, order.currency, locale)}</span>
        </p>
      </div>
    </div>
  )
}
