import {Footer} from '@/app/[locale]/_components/footer'
import {getRules} from '@/features/rules/api/get-rules'
import {RulesView} from '@/features/rules/components/rules-view'
import {numberRules} from '@/features/rules/lib/number-rules'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {getPathname} from '@/i18n/navigation'
import {type Locale, routing} from '@/i18n/routing'
import {CalendarDays} from 'lucide-react'
import type {Metadata} from 'next'
import {hasLocale} from 'next-intl'
import {getFormatter, getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

// EN has no prefix (`localePrefix: 'as-needed'`): /rules and /pl/rules.
const rulesPath = (locale: Locale) => getPathname({href: '/rules', locale})

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({locale, namespace: 'rules'})
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: rulesPath(locale),
      languages: {
        ...Object.fromEntries(routing.locales.map(l => [l, rulesPath(l)])),
        'x-default': rulesPath(routing.defaultLocale)
      }
    }
  }
}

export default async function RulesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const [rules, t, format, settings] = await Promise.all([
    getRules(locale),
    getTranslations({locale, namespace: 'rules'}),
    getFormatter({locale}),
    getSiteSettings()
  ])

  return (
    <>
      <main id="shop" className="mx-auto max-w-page px-[var(--gutter)] pt-36 pb-24">
        <header className="max-w-3xl">
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-none font-bold tracking-tight uppercase">
            {t.rich('title', {accent: chunks => <span className="text-accent">{chunks}</span>})}
          </h1>
          <p className="mt-6 text-lg text-muted">{t('lead')}</p>
          {rules && (
            <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted">
              <CalendarDays aria-hidden className="size-4 text-accent" />
              {t('edition', {
                // UTC: the edition is a calendar date, it must not move with the server's time zone.
                date: format.dateTime(new Date(rules.publishedAt), {
                  dateStyle: 'long',
                  timeZone: 'UTC'
                })
              })}
            </p>
          )}
        </header>
        <div className="mt-14">
          {rules ? (
            <RulesView sections={numberRules(rules)} rulesPath={rulesPath(locale)} />
          ) : (
            <p role="status" className="text-muted">
              {t('unavailable')}
            </p>
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  )
}
