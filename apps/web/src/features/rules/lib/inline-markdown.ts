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
