import {parseInline, toPlainText} from '@/features/rules/lib/inline-markdown'
import {findMatches} from '@/features/rules/lib/normalize-search'
import type {RuleSection} from '@/features/rules/types'

const hit = (text: string, query: string, locale: string) =>
  findMatches(text, query, locale).length > 0

/** A section stays whole when its title matches; otherwise only its matching items stay. */
export function filterRules(sections: RuleSection[], query: string, locale: string): RuleSection[] {
  const q = query.trim()
  if (!q) return sections
  return sections.flatMap(section => {
    if (hit(section.title.value, q, locale)) return [section]
    const items = section.items.filter(
      item => item.number === q || hit(toPlainText(parseInline(item.text.value)), q, locale)
    )
    return items.length > 0 ? [{...section, items}] : []
  })
}
