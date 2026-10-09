import type {PublicRules, RuleSection} from '@/features/rules/types'

export const sectionAnchor = (n: number) => `s-${String(n)}`
export const itemAnchor = (n: number, m: number) => `r-${String(n)}-${String(m)}`

/** Numbers come from position, so editors never type them and they cannot go out of order. */
export function numberRules(rules: PublicRules): RuleSection[] {
  return rules.sections.map((section, i) => {
    const n = i + 1
    return {
      id: section.id,
      number: n,
      anchor: sectionAnchor(n),
      title: section.title,
      items: section.items.map((item, j) => ({
        id: item.id,
        number: `${String(n)}.${String(j + 1)}`,
        anchor: itemAnchor(n, j + 1),
        text: item.text
      }))
    }
  })
}
