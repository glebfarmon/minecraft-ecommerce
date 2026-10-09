'use client'

import {MorphPopover} from '@/components/morph-popover'
import {CURRENCIES} from '@/config/currencies'
import {LANGUAGE_NAMES} from '@/config/locales'
import {useCurrency} from '@/features/cart/shop-provider'
import {usePathname, useRouter} from '@/i18n/navigation'
import {routing} from '@/i18n/routing'
import {Check, Globe} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

export function SettingsMenu({anchor = 'top-end'}: {anchor?: 'top-end' | 'bottom-end'}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const {currency} = useCurrency()

  const symbol = CURRENCIES.find(c => c.code === currency)?.symbol

  return (
    <MorphPopover
      anchor={anchor}
      triggerLabel={t('settings')}
      panelLabel={t('settings')}
      closeLabel={t('closePanel')}
      triggerClassName="h-11 border border-border px-4 text-sm font-medium hover:border-white/25"
      panelClassName="w-64"
      trigger={
        <>
          <Globe className="size-4 text-muted" />
          <span className="uppercase">{locale}</span>
          <span className="text-muted">·</span>
          <span>{symbol}</span>
        </>
      }>
      {close => <SettingsOptions onDone={close} />}
    </MorphPopover>
  )
}

/** Language and currency radio groups; `onDone` runs after a choice so the host can close itself. */
export function SettingsOptions({onDone}: {onDone: () => void}) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const {currency, setCurrency} = useCurrency()

  return (
    <>
      <p className="px-3 pt-2 pb-1 eyebrow-sm">{t('language')}</p>
      <div role="radiogroup" className="flex flex-col gap-0.5" aria-label={t('language')}>
        {routing.locales.map(code => (
          <Option
            key={code}
            code={code.toUpperCase()}
            label={LANGUAGE_NAMES[code]}
            selected={code === locale}
            onSelect={() => {
              onDone()
              // Keep the anchor: /rules#r-2-3 in EN is the same rule as /pl/rules#r-2-3.
              router.replace(`${pathname}${window.location.hash}`, {locale: code, scroll: false})
            }}
          />
        ))}
      </div>
      <div className="mx-3 my-2 h-px bg-line" />
      <p className="px-3 pt-1 pb-1 eyebrow-sm">{t('currency')}</p>
      <div role="radiogroup" className="flex flex-col gap-0.5" aria-label={t('currency')}>
        {CURRENCIES.map(c => (
          <Option
            key={c.code}
            code={c.symbol}
            label={c.code}
            selected={c.code === currency}
            onSelect={() => {
              setCurrency(c.code)
              onDone()
            }}
          />
        ))}
      </div>
    </>
  )
}

function Option({
  code,
  label,
  selected,
  onSelect
}: {
  code: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-white/5 ${
        selected ? 'bg-white/[0.06]' : ''
      }`}>
      <span className="w-7 text-xs font-semibold text-muted">{code}</span>
      <span className="flex-1">{label}</span>
      {selected && <Check className="size-4 text-online" />}
    </button>
  )
}
