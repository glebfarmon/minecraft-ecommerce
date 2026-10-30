import {PENDING_ORDER_KEY} from '@/config/order'
import {legalPath} from '@/config/site'
import {toCartLine} from '@/features/cart/lib/cart-cookie'
import {useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import {useCatalog} from '@/features/catalog/catalog-provider'
import {createOrder} from '@/features/checkout/api/create-order'
import type {CreateOrderResult} from '@/features/checkout/api/create-order'
import {validatePromo} from '@/features/checkout/api/validate-promo'
import type {ValidatePromoResult} from '@/features/checkout/api/validate-promo'
import {CheckField, TextField} from '@/features/checkout/components/fields'
import {OrderSummary, PayBar, orderTotal} from '@/features/checkout/components/order-summary'
import {PromoField} from '@/features/checkout/components/promo-field'
import type {PromoFieldReason} from '@/features/checkout/components/promo-field'
import {TurnstileField} from '@/features/checkout/components/turnstile-field'
import {redirectTo} from '@/features/checkout/lib/redirect'
import type {CheckoutInput, CheckoutValues} from '@/features/checkout/schemas'
import type {TurnstileInstance} from '@marsidev/react-turnstile'
import {ArrowLeft} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import {useEffect, useId, useRef, useState} from 'react'
import type {UseFormReturn} from 'react-hook-form'
import {useFormState, useWatch} from 'react-hook-form'
import * as v from 'valibot'

import {LocaleSchema} from '@shop/shared/catalog'

function LegalLink({href, children}: {href: string; children: ReactNode}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-fg underline decoration-white/30 transition-colors hover:decoration-accent">
      {children}
    </a>
  )
}

const PROMO_RECHECK_DELAY_MS = 300

// A promo failure is not an order error: it is shown on the promo field.
type OrderError = Exclude<Extract<CreateOrderResult, {ok: false}>, {error: 'promo'}>

/** A code in force, with the cart (`key`) it was checked against. */
type AppliedPromo = {code: string; discountMinor: number; key: string}

/** What a check leaves behind: the code in force, or the reason it is not. */
const settle = (
  result: ValidatePromoResult,
  key: string
): {promo: AppliedPromo | null; error: PromoFieldReason | null} =>
  result.ok
    ? {promo: {code: result.code, discountMinor: result.discountMinor, key}, error: null}
    : {promo: null, error: result.reason}

const ERROR_KEYS = {
  unavailable: 'errors.unavailable',
  turnstile: 'errors.turnstile',
  rate_limited: 'errors.rateLimited',
  unavailable_payments: 'errors.payments',
  invalid: 'errors.invalid'
} as const

type Props = {
  form: UseFormReturn<CheckoutInput, unknown, CheckoutValues>
  titleId: string
  onBack: () => void
}

export function CheckoutForm({form, titleId, onBack}: Props) {
  const t = useTranslations('checkout')
  const locale = useLocale()
  const {lines} = useCart()
  const {findServer} = useCatalog()
  const {remove} = useCartActions()
  const {currency} = useCurrency()
  const {register, handleSubmit, control} = form
  // `formState` is one mutable proxy, which the React Compiler would memoize into a stale read; `useFormState` returns a fresh object per change.
  const {errors, isValid} = useFormState({control})
  const nick = useWatch({control, name: 'nick'})
  const orderLines = lines
    .map(toCartLine)
    .map(({server, slug, qty}) => ({server, slug, quantity: qty}))
  // The cart as a promo check sees it: a change of lines or currency calls for a new check.
  const cartKey = JSON.stringify([currency, orderLines])
  const [promo, setPromo] = useState<AppliedPromo | null>(null)
  const [promoError, setPromoError] = useState<PromoFieldReason | null>(null)
  const [applying, setApplying] = useState(false)
  // A code checked against another cart is on its way to a re-check; the old discount shows until then.
  const rechecking = promo !== null && promo.key !== cartKey && lines.length > 0
  const checkingPromo = applying || rechecking
  const subtotal = orderTotal(lines, currency)
  const discount = promo?.discountMinor ?? 0
  // The API recomputes the price anyway; this is what the player is told they will pay.
  const total = Math.max(0, subtotal - discount)
  const errorId = useId()
  const widget = useRef<TurnstileInstance>(null)
  const [token, setToken] = useState<string | null>(null)
  // Stays true after a successful submit: the page is navigating to the payment provider.
  const [pending, setPending] = useState(false)
  const [orderError, setOrderError] = useState<OrderError | null>(null)

  useEffect(() => {
    if (!promo || promo.key === cartKey || lines.length === 0) return
    let cancelled = false
    const body = {
      code: promo.code,
      currency,
      lines: lines.map(toCartLine).map(({server, slug, qty}) => ({server, slug, quantity: qty}))
    }
    // Quick quantity clicks settle into one check, so they cannot use up the validate rate limit.
    const timer = setTimeout(() => {
      void validatePromo(body).then(result => {
        if (cancelled) return
        const next = settle(result, cartKey)
        setPromo(next.promo)
        setPromoError(next.error)
      })
    }, PROMO_RECHECK_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [promo, cartKey, currency, lines])

  const applyPromo = async (code: string) => {
    setApplying(true)
    const key = cartKey
    const result = await validatePromo({code, currency, lines: orderLines})
    const next = settle(result, key)
    setPromo(next.promo)
    setPromoError(next.error)
    setApplying(false)
  }
  const removePromo = () => {
    setPromo(null)
    setPromoError(null)
  }

  const submit = async (values: CheckoutValues) => {
    if (!token || pending) return
    setPending(true)
    setOrderError(null)
    const result = await createOrder({
      lines: orderLines,
      currency,
      locale: v.parse(LocaleSchema, locale),
      nick: values.nick,
      email: values.email,
      deliveryConsent: true,
      termsAccepted: true,
      turnstileToken: token,
      ...(promo && {promoCode: promo.code})
    })
    if (result.ok) {
      // The status page clears the cart only for the order this browser just started.
      try {
        localStorage.setItem(PENDING_ORDER_KEY, result.publicId)
      } catch {
        // Private mode: the cart simply stays after payment.
      }
      redirectTo(result.redirectUrl)
      return
    }
    if (result.error === 'promo') {
      // No order was made: the code goes, the reason shows on the field, and the player can pay without it.
      setPromo(null)
      setPromoError(result.reason)
    } else {
      setOrderError(result)
    }
    // A token is single-use, so whatever went wrong the player needs a new one.
    setToken(null)
    widget.current?.reset()
    setPending(false)
  }

  // Lines of a server without RCON are known to be refused, so they are marked before the player fills the form.
  const unpurchasable = lines
    .filter(l => findServer(l.product.server)?.purchasable === false)
    .map(l => `${l.product.server}/${l.product.slug}`)
  const unavailable = new Set([
    ...unpurchasable,
    ...(orderError?.error === 'unavailable'
      ? orderError.lines.map(l => `${l.server}/${l.slug}`)
      : [])
  ])
  const removeUnavailable = () => {
    for (const {product} of lines) {
      if (unavailable.has(`${product.server}/${product.slug}`)) remove(product)
    }
    setOrderError(null)
  }
  const payDisabled = !isValid || !token || unpurchasable.length > 0 || checkingPromo

  const error = (key: keyof CheckoutInput) => {
    const code = errors[key]?.message
    return code ? t(`errors.${code}`) : undefined
  }
  const legal = (doc: 'terms' | 'privacy', chunks: ReactNode) => (
    <LegalLink href={legalPath(doc, locale)}>{chunks}</LegalLink>
  )

  return (
    <form
      noValidate
      onSubmit={e => {
        void handleSubmit(submit)(e)
      }}
      // A column on phones so the pay bar can stick against the whole form; two columns from md.
      className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex flex-col gap-5 px-1 md:px-3 md:pt-1">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('back')}
          </button>
          <h2
            id={titleId}
            className="text-[clamp(2rem,5vw,2.75rem)] leading-[1] font-bold tracking-[-0.03em]">
            {t('title')}
          </h2>
        </div>

        <TextField
          label={t('nick.label')}
          hint={t('nick.hint')}
          error={error('nick')}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          {...register('nick')}
        />
        <TextField
          type="email"
          inputMode="email"
          label={t('email.label')}
          hint={t('email.hint')}
          error={error('email')}
          autoComplete="email"
          {...register('email')}
        />
        <TurnstileField widgetRef={widget} onToken={setToken} />

        <div className="mt-1 flex flex-col gap-4">
          <CheckField label={t('delivery')} error={error('delivery')} {...register('delivery')} />
          <CheckField
            label={t.rich('terms', {
              terms: chunks => legal('terms', chunks),
              privacy: chunks => legal('privacy', chunks)
            })}
            error={error('terms')}
            {...register('terms')}
          />
        </div>

        {!orderError && unpurchasable.length > 0 && (
          <div role="alert" className="flex flex-col items-start gap-2 text-sm">
            <p className="text-danger">{t('errors.unavailable')}</p>
            <button
              type="button"
              onClick={removeUnavailable}
              className="inline-flex h-11 items-center rounded-full border border-line px-4 font-medium transition-colors hover:bg-card">
              {t('removeUnavailable')}
            </button>
          </div>
        )}

        {orderError && (
          <div id={errorId} role="alert" className="flex flex-col items-start gap-2 text-sm">
            <p className="text-danger">{t(ERROR_KEYS[orderError.error])}</p>
            {orderError.error === 'unavailable' && (
              <button
                type="button"
                onClick={removeUnavailable}
                className="inline-flex h-11 items-center rounded-full border border-line px-4 font-medium transition-colors hover:bg-card">
                {t('removeUnavailable')}
              </button>
            )}
          </div>
        )}
      </div>

      <OrderSummary
        lines={lines}
        currency={currency}
        total={total}
        discount={discount}
        promo={
          <PromoField
            applied={promo?.code ?? null}
            error={promoError}
            checking={checkingPromo}
            onApply={code => {
              void applyPromo(code)
            }}
            onRemove={removePromo}
          />
        }
        nick={nick.trim()}
        disabled={payDisabled}
        busy={pending}
        unavailable={unavailable}
        errorId={orderError ? errorId : undefined}
      />
      <PayBar total={total} currency={currency} disabled={payDisabled} busy={pending} />
    </form>
  )
}
