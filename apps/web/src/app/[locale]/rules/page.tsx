import {Footer} from '@/app/[locale]/_components/footer'
import {loadCatalog} from '@/features/catalog/api/get-catalog'
import {getRules} from '@/features/rules/api/get-rules'
import {RulesHeader} from '@/features/rules/components/rules-header'
import {RulesView} from '@/features/rules/components/rules-view'
import {formatEdition} from '@/features/rules/lib/format-edition'
import {numberRules} from '@/features/rules/lib/number-rules'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'
import {getPathname} from '@/i18n/navigation'
import {type Locale, routing} from '@/i18n/routing'
import type {Metadata} from 'next'
import {hasLocale} from 'next-intl'
import {getTranslations} from 'next-intl/server'
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
  const [rules, t, settings, catalog] = await Promise.all([
    getRules(locale),
    getTranslations({locale, namespace: 'rules'}),
    getSiteSettings(),
    loadCatalog(locale)
  ])

  return (
    <>
      <main id="shop" className="rules-page mx-auto max-w-page px-[var(--gutter)] pt-36 pb-24">
        <RulesHeader
          title={t.raw('title') as string}
          lead={t('lead')}
          edition={rules ? t('edition', {date: formatEdition(rules.publishedAt, locale)}) : null}
        />
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
      <Footer settings={settings} servers={catalog?.servers ?? []} />
    </>
  )
}
