'use client'

import {CONSENT_COOKIE, CONSENT_MAX_AGE_S} from '@/config/consent'
import {EASE} from '@/config/motion'
import {legalPath} from '@/config/site'
import {AnimatePresence, motion} from 'motion/react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

const hasConsent = () => document.cookie.split('; ').some(c => c.startsWith(`${CONSENT_COOKIE}=`))

/** Asks once; the answer lives in a cookie, so the banner never comes back. */
export function CookieBanner() {
  const t = useTranslations('consent')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  // Cookies are only readable in the browser, so the banner appears after hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!hasConsent())
  }, [])

  const save = (withAnalytics: boolean) => {
    const value = withAnalytics ? 'all' : 'necessary'
    document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${String(CONSENT_MAX_AGE_S)}; path=/; samesite=lax`
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="region"
          aria-label={t('label')}
          initial={{opacity: 0, y: 24}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 24}}
          transition={{duration: 0.4, ease: EASE}}
          className="fixed right-4 bottom-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-2xl">
          <p className="text-sm text-muted">
            {t('text')}{' '}
            <a
              href={legalPath('cookies', locale)}
              target="_blank"
              rel="noreferrer"
              className="text-fg underline underline-offset-2">
              {t('policy')}
            </a>
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-3 opacity-60">
              <input type="checkbox" checked disabled className="size-4 accent-accent" />
              <span>{t('necessary')}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={e => {
                  setAnalytics(e.target.checked)
                }}
                className="size-4 accent-accent"
              />
              <span>{t('analytics')}</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                save(analytics)
              }}
              className="h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium transition-[border-color,transform] duration-200 hover:border-white/25 active:scale-[0.98]">
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => {
                save(true)
              }}
              className="h-11 flex-1 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98]">
              {t('acceptAll')}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
