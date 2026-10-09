'use client'

import {Highlight} from '@/features/rules/components/highlight'
import {RichText} from '@/features/rules/components/rich-text'
import {RuleActions} from '@/features/rules/components/rule-actions'
import {parseInline, toPlainText} from '@/features/rules/lib/inline-markdown'
import type {RuleItem} from '@/features/rules/types'

export function RuleRow({
  item,
  query,
  locale,
  rulesPath
}: {
  item: RuleItem
  query: string
  locale: string
  rulesPath: string
}) {
  return (
    // `target:` flashes the rule a link (#r-2-3) points to; scroll-mt clears the fixed navbar.
    <li
      id={item.anchor}
      className="group flex scroll-mt-28 gap-4 rounded-xl px-4 py-4 target:animate-rule-flash">
      <a
        href={`#${item.anchor}`}
        className="tabular w-10 shrink-0 pt-0.5 font-mono text-sm text-accent hover:underline">
        {item.number}
      </a>
      <p
        lang={item.text.lang === locale ? undefined : item.text.lang}
        className="min-w-0 flex-1 leading-relaxed break-words text-fg/85">
        <RichText
          text={item.text.value}
          mark={value => <Highlight text={value} query={query} locale={locale} />}
        />
      </p>
      <RuleActions
        number={item.number}
        plainText={toPlainText(parseInline(item.text.value))}
        href={`${rulesPath}#${item.anchor}`}
      />
    </li>
  )
}
