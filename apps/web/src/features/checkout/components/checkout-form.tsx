import {legalPath} from '@/config/site'
import {toCartLine} from '@/features/cart/lib/cart-cookie'
import {useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import {createOrder} from '@/features/checkout/api/create-order'
import type {CreateOrderResult} from '@/features/checkout/api/create-order'
import {CheckField, TextField} from '@/features/checkout/components/fields'
import {OrderSummary, PayBar, orderTotal} from '@/features/checkout/components/order-summary'
import {TurnstileField} from '@/features/checkout/components/turnstile-field'
import {redirectTo} from '@/features/checkout/lib/redirect'
import type {CheckoutInput, CheckoutValues} from '@/features/checkout/schemas'
import type {TurnstileInstance} from '@marsidev/react-turnstile'
import {ArrowLeft} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import {useId, useRef, useState} from 'react'
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

type OrderError = Extract<CreateOrderResult, {ok: false}>

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
  const {remove} = useCartActions()
  const {currency} = useCurrency()
  const {register, handleSubmit, control} = form
  // `formState` is one mutable proxy, which the React Compiler would memoize into a stale read; `useFormState` returns a fresh object per change.
  const {errors, isValid} = useFormState({control})
  const nick = useWatch({control, name: 'nick'})
  const total = orderTotal(lines, currency)
  const errorId = useId()
  const widget = useRef<TurnstileInstance>(null)
  const [token, setToken] = useState<string | null>(null)
  // Stays true after a successful submit: the page is navigating to the payment provider.
  const [pending, setPending] = useState(false)
  const [orderError, setOrderError] = useState<OrderError | null>(null)

  const submit = async (values: CheckoutValues) => {
    if (!token || pending) return
    setPending(true)
    setOrderError(null)
    const result = await createOrder({
      lines: lines.map(toCartLine).map(({server, slug, qty}) => ({server, slug, quantity: qty})),
      currency,
      locale: v.parse(LocaleSchema, locale),
      nick: values.nick,
      email: values.email,
      deliveryConsent: true,
      termsAccepted: true,
      turnstileToken: token
    })
    if (result.ok) {
      redirectTo(result.redirectUrl)
      return
    }
    setOrderError(result)
    // A token is single-use, so whatever went wrong the player needs a new one.
    setToken(null)
    widget.current?.reset()
    setPending(false)
  }

  const unavailable = new Set(
    orderError?.error === 'unavailable' ? orderError.lines.map(l => `${l.server}/${l.slug}`) : []
  )
  const removeUnavailable = () => {
    for (const {product} of lines) {
      if (unavailable.has(`${product.server}/${product.slug}`)) remove(product)
    }
    setOrderError(null)
  }
  const payDisabled = !isValid || !token

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
