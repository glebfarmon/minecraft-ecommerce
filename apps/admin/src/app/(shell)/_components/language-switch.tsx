'use client'

import {Hint} from '@/components/hint'
import {RollingIndicator} from '@/components/rolling-indicator'
import {type AdminLocale, LOCALE_COOKIE} from '@/i18n/locale'
import {LayoutGroup} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useId} from 'react'

import {cn} from '@shop/ui/lib/utils'

const OPTIONS: {locale: AdminLocale; label: string; name: string}[] = [
  {locale: 'en', label: 'EN', name: 'English'},
  {locale: 'pl', label: 'PL', name: 'Polski'}
]

const YEAR = String(60 * 60 * 24 * 365)

function saveLocale(locale: AdminLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${YEAR}; samesite=lax`
}

/**
 * EN / PL choice. The pill rolls between the two (the shared rolling indicator); the choice is a cookie the
 * server reads, so no route changes and `refresh()` re-renders the current page in the new language.
 */
export function LanguageSwitch({orientation}: {orientation: 'vertical' | 'horizontal'}) {
  const t = useTranslations('shell')
  const active = useLocale()
  const router = useRouter()
  const group = useId()

  function choose(locale: AdminLocale) {
    if (locale === active) return
    saveLocale(locale)
    router.refresh()
  }

  return (
    <LayoutGroup id={group}>
      <div
        role="radiogroup"
        aria-label={t('language')}
        className={cn(
          'flex gap-0.5 rounded-full bg-card p-0.5',
          orientation === 'vertical' ? 'flex-col' : 'w-fit'
        )}>
        {OPTIONS.map(({locale, label, name}) => {
          const checked = locale === active
          return (
            <Hint key={locale} label={name} side={orientation === 'vertical' ? 'right' : 'bottom'}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  choose(locale)
                }}
                className={cn(
                  'relative isolate flex h-7 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold tracking-wide transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                  checked ? 'text-fg' : 'text-muted hover:text-fg'
                )}>
                {checked && <RollingIndicator className="rounded-full bg-card-raised" />}
                {label}
              </button>
            </Hint>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
