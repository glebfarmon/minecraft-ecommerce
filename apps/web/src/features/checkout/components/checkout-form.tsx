import {legalPath} from '@/config/site'
import {useCart, useCurrency} from '@/features/cart/shop-provider'
import {CheckField, TextField} from '@/features/checkout/components/fields'
import {OrderSummary, PayBar, orderTotal} from '@/features/checkout/components/order-summary'
import type {CheckoutInput, CheckoutValues} from '@/features/checkout/schemas'
import {ArrowLeft, Plus} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import {useState} from 'react'
import type {UseFormReturn} from 'react-hook-form'
import {useFormState, useWatch} from 'react-hook-form'

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

type Props = {
  form: UseFormReturn<CheckoutInput, unknown, CheckoutValues>
  titleId: string
  onBack: () => void
}

export function CheckoutForm({form, titleId, onBack}: Props) {
  const t = useTranslations('checkout')
  const locale = useLocale()
  const {lines} = useCart()
  const {currency} = useCurrency()
  const {register, handleSubmit, control} = form
  // `formState` is one mutable proxy, which the React Compiler would memoize into a stale read; `useFormState` returns a fresh object per change.
  const {errors} = useFormState({control})
  const nick = useWatch({control, name: 'nick'})
  // Most players have no code: the field hides behind a toggle, but never with a value inside it.
  const [promoOpen, setPromoOpen] = useState(() => form.getValues('promo') !== '')
  const total = orderTotal(lines, currency)

  const error = (key: keyof CheckoutInput) => {
    const code = errors[key]?.message
    return code ? t(`errors.${code}`) : undefined
  }
  const legal = (doc: 'terms' | 'privacy', chunks: ReactNode) => (
    <LegalLink href={legalPath(doc, locale)}>{chunks}</LegalLink>
  )

  return (
    // No payment call yet: a valid submit has nowhere to go until the orders API exists.
    <form
      noValidate
      onSubmit={e => {
        void handleSubmit(() => undefined)(e)
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
        {promoOpen ? (
          <TextField
            label={t('promo.label')}
            hint={t('promo.hint')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            {...register('promo')}
          />
        ) : (
          <button
            type="button"
            aria-expanded="false"
            onClick={() => {
              setPromoOpen(true)
            }}
            className="-my-1 inline-flex h-11 items-center gap-1.5 self-start rounded-full text-sm text-muted transition-colors hover:text-fg">
            <Plus className="size-4" aria-hidden="true" />
            {t('promo.toggle')}
          </button>
        )}

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
      </div>

      <OrderSummary lines={lines} currency={currency} total={total} nick={nick.trim()} />
      <PayBar total={total} currency={currency} />
    </form>
  )
}
