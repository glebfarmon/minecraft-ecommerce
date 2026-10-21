import type {JSONContent} from '@tiptap/core'

import {type RichNode, parseRich, toMarkdown} from '@shop/shared/rules'

type Options = {multiline: boolean; links: boolean}
type Mark = NonNullable<JSONContent['marks']>[number]
type Run = {value: string; marks: Mark[]}

const MARK_OF = {strong: 'bold', em: 'italic', u: 'underline'} as const
// Outermost first: a link wraps bold, which wraps italic, which wraps underline.
const ORDER = ['link', 'bold', 'italic', 'underline'] as const
const NODE_OF = {bold: 'strong', italic: 'em', underline: 'u'} as const

function flatten(nodes: RichNode[], marks: Mark[], out: Run[]) {
  for (const node of nodes) {
    if (node.type === 'text') out.push({value: node.value, marks})
    else {
      const mark: Mark =
        node.type === 'link' ? {type: 'link', attrs: {href: node.href}} : {type: MARK_OF[node.type]}
      flatten(node.children, [...marks, mark], out)
    }
  }
}

/** Mini-markdown → ProseMirror JSON: one paragraph; `\n` becomes a hard break when multiline. */
export function toDoc(markdown: string, {multiline, links}: Options): JSONContent {
  const runs: Run[] = []
  flatten(parseRich(markdown, {links}), [], runs)
  const content: JSONContent[] = []
  for (const {value, marks} of runs) {
    const lines = multiline ? value.split('\n') : [value]
    lines.forEach((line, i) => {
      if (i > 0) content.push({type: 'hardBreak'})
      if (line !== '') content.push({type: 'text', text: line, ...(marks.length ? {marks} : {})})
    })
  }
  return {
    type: 'doc',
    content: [content.length ? {type: 'paragraph', content} : {type: 'paragraph'}]
  }
}

// `[label](href)` cannot hold a ")" or a space in the href; a link that would not survive is dropped.
const writable = (mark: Mark) =>
  mark.type !== 'link' || /^[^)\s]+$/.test(String(mark.attrs?.href ?? ''))

const markType = (run: Run, type: string) => run.marks.find(m => m.type === type)

// Groups consecutive runs that share the next mark in ORDER into one node, so adjacent bold
// pieces become a single `**…**` and nesting survives the trip.
function build(runs: Run[], depth: number): RichNode[] {
  const type = ORDER[depth]
  if (type === undefined) return runs.map(run => ({type: 'text', value: run.value}))
  const out: RichNode[] = []
  for (let i = 0; i < runs.length;) {
    const run = runs[i] as Run
    const mark = markType(run, type)
    if (!mark) {
      const start = i
      while (i < runs.length && !markType(runs[i] as Run, type)) i++
      out.push(...build(runs.slice(start, i), depth + 1))
      continue
    }
    const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
    const same = (r: Run) => {
      const m = markType(r, type)
      return !!m && (type !== 'link' || m.attrs?.href === href)
    }
    const start = i
    while (i < runs.length && same(runs[i] as Run)) i++
    const children = build(runs.slice(start, i), depth + 1)
    out.push(type === 'link' ? {type, href, children} : {type: NODE_OF[type], children})
  }
  return out
}

/** ProseMirror JSON → mini-markdown. Several paragraphs (a paste) join with `\n`. */
export function fromDoc(doc: JSONContent): string {
  const runs: Run[] = []
  ;(doc.content ?? []).forEach((block, p) => {
    if (p > 0) runs.push({value: '\n', marks: []})
    for (const inline of block.content ?? []) {
      if (inline.type === 'hardBreak') runs.push({value: '\n', marks: []})
      else if (inline.text)
        runs.push({value: inline.text, marks: (inline.marks ?? []).filter(writable)})
    }
  })
  return toMarkdown(build(runs, 0))
}
