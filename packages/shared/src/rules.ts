import * as v from 'valibot'

export type Inline =
  {type: 'text' | 'strong' | 'em'; value: string} | {type: 'link'; value: string; href: string}

// **bold** | *italic* | [label](href). Non-greedy, no nesting: rule texts are short sentences.
const TOKEN = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
// https:// or a site path; `//host` is protocol-relative and would leave the site.
const SAFE_HREF = /^(https:\/\/|\/(?!\/))/i

/** Mini-markdown used by rules: bold, italic and safe links. Anything else stays literal text. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const match of source.matchAll(TOKEN)) {
    const start = match.index
    if (start > last) out.push({type: 'text', value: source.slice(last, start)})
    const [, strong, em, label, href] = match
    if (strong !== undefined) out.push({type: 'strong', value: strong})
    else if (em !== undefined) out.push({type: 'em', value: em})
    else if (label !== undefined && href !== undefined)
      out.push(
        SAFE_HREF.test(href) ? {type: 'link', value: label, href} : {type: 'text', value: label}
      )
    last = start + match[0].length
  }
  if (last < source.length) out.push({type: 'text', value: source.slice(last)})
  return out
}

/** The words a reader sees: what search matches and what "copy text" puts on the clipboard. */
export const toPlainText = (tokens: Inline[]) => tokens.map(token => token.value).join('')

const LINK = /\[[^\]]+\]\(([^)\s]+)\)/g

/** Every [label](href) in the text points to https: or a site path (spec §5). */
export const hasOnlySafeLinks = (text: string): boolean =>
  [...text.matchAll(LINK)].every(m => SAFE_HREF.test(m[1] ?? ''))

const SAFE_LINKS = 'Links must start with https:// or /'
const RuleText = (max: number) =>
  v.object({
    en: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, 'Enter the English text'),
      v.maxLength(max),
      v.check(hasOnlySafeLinks, SAFE_LINKS),
      v.description('English text; **bold**, *italic* and [label](https://… or /path) links')
    ),
    pl: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(max),
        v.check(hasOnlySafeLinks, SAFE_LINKS),
        v.description('Polish text; the English text is shown when empty')
      )
    )
  })
const RuleId = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9-]{1,60}$/),
  v.description('Stable id: 1–60 of a–z, 0–9 and "-"')
)
const unique = (ids: string[]) => new Set(ids).size === ids.length

export const RulesDocumentSchema = v.pipe(
  v.object({
    sections: v.pipe(
      v.array(
        v.object({
          id: RuleId,
          title: RuleText(120),
          items: v.pipe(v.array(v.object({id: RuleId, text: RuleText(2000)})), v.maxLength(100))
        })
      ),
      v.maxLength(50)
    )
  }),
  v.check(d => unique(d.sections.map(s => s.id)), 'Section ids must be unique'),
  v.check(d => unique(d.sections.flatMap(s => s.items.map(i => i.id))), 'Item ids must be unique')
)
export type RulesDocument = v.InferOutput<typeof RulesDocumentSchema>

const Localized = v.object({
  value: v.pipe(v.string(), v.description('Text in the language below')),
  lang: v.pipe(v.picklist(['en', 'pl']), v.description('Language of value (EN fallback)'))
})
export const PublicRulesSchema = v.object({
  publishedAt: v.pipe(v.string(), v.isoTimestamp()),
  sections: v.array(
    v.object({
      id: v.string(),
      title: Localized,
      items: v.array(v.object({id: v.string(), text: Localized}))
    })
  )
})
export type PublicRules = v.InferOutput<typeof PublicRulesSchema>
