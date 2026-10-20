import * as v from 'valibot'

import {VALIDATION_MESSAGES} from './validation-messages'

export type RichNode =
  | {type: 'text'; value: string}
  | {type: 'strong' | 'em' | 'u'; children: RichNode[]}
  | {type: 'link'; href: string; children: RichNode[]}

// https:// or a site path; `//host` and `/\host` (browsers read `\` as `/`) would leave the site.
const SAFE_HREF = /^(https:\/\/|\/(?![/\\]))/i
const ESCAPABLE = '\\*+[]()'
const HREF = /\(([^)\s]+)\)/y

// Deeper nesting is literal text: real rules never nest this far, and the parser recurses.
const MAX_DEPTH = 20

type Context = 'strong' | 'em' | 'u' | 'link' | null
type Parsed = {nodes: RichNode[]; end: number}

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch)

function pushText(nodes: RichNode[], value: string) {
  const last = nodes.at(-1)
  if (last?.type === 'text') nodes[nodes.length - 1] = {type: 'text', value: last.value + value}
  else nodes.push({type: 'text', value})
}

/**
 * Mini-markdown used by rules and product descriptions: `**bold**`, `*italic*`, `++underline++`
 * and (with `links`) `[label](href)`; `\` escapes any of `\ * + [ ] ( )`. Marks nest. An opener
 * without a closer stays literal text, so a stray `**` never swallows the rest of the string.
 */
export function parseRich(source: string, {links = true}: {links?: boolean} = {}): RichNode[] {
  const memo = new Map<string, Parsed | null>()

  // Parses from `start` until the closer of `context` (or the end of the source for null).
  // Returns null when that closer never comes.
  function sequence(
    start: number,
    context: Context,
    inLink: boolean,
    depth: number
  ): Parsed | null {
    const key = `${String(start)}:${String(context)}:${String(inLink)}:${String(depth)}`
    if (memo.has(key)) return memo.get(key) ?? null
    const result = scan(start, context, inLink, depth)
    memo.set(key, result)
    return result
  }

  function scan(start: number, context: Context, inLink: boolean, depth: number): Parsed | null {
    const nodes: RichNode[] = []
    let i = start
    while (i < source.length) {
      const ch = source.charAt(i)
      const next = source.charAt(i + 1)
      if (ch === '\\' && next !== '' && ESCAPABLE.includes(next)) {
        pushText(nodes, next)
        i += 2
        continue
      }
      if (ch === ']' && context === 'link') return {nodes, end: i + 1}
      if (ch === '*' || ch === '+') {
        let run = 1
        while (source.charAt(i + run) === ch) run++
        const canClose = i > start && !isSpace(source[i - 1])
        const canOpen = !isSpace(source[i + run])
        if (ch === '*' && context === 'strong' && run >= 2 && canClose) return {nodes, end: i + 2}
        if (ch === '*' && context === 'em' && run !== 2 && canClose) return {nodes, end: i + 1}
        if (ch === '+' && context === 'u' && run >= 2 && canClose) return {nodes, end: i + 2}
        const mark: 'strong' | 'em' | 'u' | null =
          ch === '+' ? (run >= 2 ? 'u' : null) : run >= 2 ? 'strong' : 'em'
        const width = mark === 'em' ? 1 : 2
        const inner =
          mark && canOpen && depth < MAX_DEPTH ? sequence(i + width, mark, inLink, depth + 1) : null
        if (mark && inner) {
          nodes.push({type: mark, children: inner.nodes})
          i = inner.end
        } else {
          // Failed opener: a long run retries one character later, a short one is literal.
          const take = run >= 3 && canOpen ? 1 : run
          pushText(nodes, ch.repeat(take))
          i += take
        }
        continue
      }
      if (ch === '[' && links && !inLink && depth < MAX_DEPTH) {
        const label = sequence(i + 1, 'link', true, depth + 1)
        if (label && label.nodes.length > 0) {
          HREF.lastIndex = label.end
          const match = HREF.exec(source)
          const href = match?.[1]
          if (match && href !== undefined) {
            if (SAFE_HREF.test(href)) nodes.push({type: 'link', href, children: label.nodes})
            else
              for (const node of label.nodes)
                if (node.type === 'text') pushText(nodes, node.value)
                else nodes.push(node)
            i = label.end + match[0].length
            continue
          }
        }
      }
      pushText(nodes, ch)
      i++
    }
    return context === null ? {nodes, end: i} : null
  }

  return sequence(0, null, false, 0)?.nodes ?? []
}

/** The words a reader sees: what search matches and what "copy text" puts on the clipboard. */
export const toPlainText = (nodes: RichNode[]): string =>
  nodes.map(node => (node.type === 'text' ? node.value : toPlainText(node.children))).join('')

const MARK = {strong: '**', em: '*', u: '++'} as const

/** Inverse of `parseRich`: escapes markup characters in text; edge spaces stay outside a mark. */
export function toMarkdown(nodes: RichNode[]): string {
  return nodes
    .map(node => {
      if (node.type === 'text') return node.value.replace(/[\\*+[\]()]/g, '\\$&')
      const inner = toMarkdown(node.children)
      if (node.type === 'link') return `[${inner}](${node.href})`
      const [, lead = '', body = '', trail = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner) ?? []
      return body === '' ? inner : `${lead}${MARK[node.type]}${body}${MARK[node.type]}${trail}`
    })
    .join('')
}

const LINK = /\[[^\]]+\]\(([^)\s]+)\)/g

/** Every [label](href) in the text points to https: or a site path (spec §5). Escaped brackets are text. */
export const hasOnlySafeLinks = (text: string): boolean =>
  [...text.replace(/\\[\\*+[\]()]/g, 'xx').matchAll(LINK)].every(m => SAFE_HREF.test(m[1] ?? ''))

const RuleText = (max: number) =>
  v.object({
    en: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, VALIDATION_MESSAGES.ruleTextRequired),
      v.maxLength(max),
      v.check(hasOnlySafeLinks, VALIDATION_MESSAGES.safeLinks),
      v.description(
        'English text; **bold**, *italic*, ++underline++ and [label](https://… or /path) links; \\ escapes * + [ ] ( )'
      )
    ),
    pl: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(max),
        v.check(hasOnlySafeLinks, VALIDATION_MESSAGES.safeLinks),
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
  v.check(d => unique(d.sections.map(s => s.id)), VALIDATION_MESSAGES.sectionIdsUnique),
  v.check(
    d => unique(d.sections.flatMap(s => s.items.map(i => i.id))),
    VALIDATION_MESSAGES.itemIdsUnique
  )
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
