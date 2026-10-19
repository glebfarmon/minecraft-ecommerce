'use client'

import {Fragment} from 'react'

import {type RulesDocument, parseInline} from '@shop/shared/rules'

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
            className="text-accent underline underline-offset-2"
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

/** How the rules page will number and render the document in the editor's language. */
export function RulesPreview({content, locale}: {content: RulesDocument; locale: Locale}) {
  return (
    <section aria-label="Preview" className="flex flex-col gap-4 rounded-card bg-card p-5">
      <h2 className="text-[15px] font-semibold">Preview · {locale.toUpperCase()}</h2>
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
