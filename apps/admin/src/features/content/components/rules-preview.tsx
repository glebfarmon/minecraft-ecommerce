'use client'

import {Hint} from '@/components/hint'
import {RichText} from '@/components/rich-text/rich-text'
import {useTranslations} from 'next-intl'

import type {RulesDocument} from '@shop/shared/rules'

type Locale = 'en' | 'pl'
type Text = {en: string; pl?: string}

/** The text the site shows in `locale`: PL falls back to EN when empty, as the public API does. */
function Localized({text, locale}: {text: Text; locale: Locale}) {
  const t = useTranslations('content')
  const pl = text.pl?.trim()
  const fallback = locale === 'pl' && !pl
  return (
    <>
      <RichText text={locale === 'pl' && pl ? pl : text.en} />
      {fallback && (
        <Hint label={t('usesEnglishText')}>
          <span
            tabIndex={0}
            aria-label={t('enFallback')}
            className="ml-2 rounded border border-border px-1 align-middle text-[10px] font-medium text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
            {t('en')}
          </span>
        </Hint>
      )}
    </>
  )
}

/** How the rules page will number and render the document in the editor's language. */
export function RulesPreview({content, locale}: {content: RulesDocument; locale: Locale}) {
  const t = useTranslations('content')
  return (
    <section aria-label={t('preview')} className="flex flex-col gap-4 rounded-card bg-card p-5">
      <h2 className="text-[15px] font-semibold">
        {t('previewIn', {locale: locale.toUpperCase()})}
      </h2>
      {content.sections.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('noSectionsYet')}</p>
      )}
      {content.sections.map((section, si) => (
        // Index keys: sections added in the editor have no id until they are saved.
        <div key={si} className="flex flex-col gap-2">
          <h3 className="font-semibold">
            {`${String(si + 1)}. `}
            <Localized text={section.title} locale={locale} />
          </h3>
          <ol className="flex flex-col gap-1.5">
            {section.items.map((item, ii) => (
              <li key={ii} className="flex gap-2 text-sm leading-relaxed">
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {`${String(si + 1)}.${String(ii + 1)}`}
                </span>
                <span>
                  <Localized text={item.text} locale={locale} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
