'use client'

import {Fragment, useState} from 'react'

import {type RulesDocument, parseInline} from '@shop/shared/rules'
import {cn} from '@shop/ui/lib/utils'

type Locale = 'en' | 'pl'
type Text = {en: string; pl?: string}

const FALLBACK = 'Uses the English text'

/** Rule mini-markdown with the admin's tokens; unsafe links come back from `parseInline` as text. */
function RichText({text}: {text: string}) {
  return parseInline(text).map((token, i) => {
    switch (token.type) {
      case 'strong':
        return (
          <strong key={i} className="font-semibold">
            {token.value}
          </strong>
        )
      case 'em':
        return <em key={i}>{token.value}</em>
      case 'link':
        return (
          <a
            key={i}
            href={token.href}
            className="text-primary underline underline-offset-2"
            {...(token.href.startsWith('https://')
              ? {target: '_blank', rel: 'noopener noreferrer'}
              : {})}>
            {token.value}
          </a>
        )
      default:
        return <Fragment key={i}>{token.value}</Fragment>
    }
  })
}

/** The text the site shows in `locale`: PL falls back to EN when empty, as the public API does. */
function Localized({text, locale}: {text: Text; locale: Locale}) {
  const pl = text.pl?.trim()
  const fallback = locale === 'pl' && !pl
  return (
    <>
      <RichText text={locale === 'pl' && pl ? pl : text.en} />
      {fallback && (
        <span
          title={FALLBACK}
          className="ml-2 rounded border px-1 align-middle text-[10px] font-medium text-muted-foreground">
          EN
        </span>
      )}
    </>
  )
}

/** How the rules page will number and render the document, in EN or PL. */
export function RulesPreview({content}: {content: RulesDocument}) {
  const [locale, setLocale] = useState<Locale>('en')

  return (
    <section aria-label="Preview" className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Preview</h2>
        <div
          role="group"
          aria-label="Preview language"
          className="flex gap-1 rounded-md border p-1">
          {(['en', 'pl'] as const).map(l => (
            <button
              key={l}
              type="button"
              aria-pressed={locale === l}
              onClick={() => {
                setLocale(l)
              }}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none',
                locale === l ? 'bg-card-raised' : 'text-muted-foreground hover:bg-card-raised'
              )}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {content.sections.length === 0 && (
        <p className="text-sm text-muted-foreground">No sections yet.</p>
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
