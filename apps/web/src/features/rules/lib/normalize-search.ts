/** One character as search compares it: locale lower case, no diacritics, ł → l (ł has no decomposition). */
function fold(char: string, locale: string) {
  return char.toLocaleLowerCase(locale).normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l')
}

/** Folded text plus, per folded UTF-16 unit, the [start, end) of the original character it came from. */
function index(text: string, locale: string) {
  let folded = ''
  const spans: [number, number][] = []
  let pos = 0
  for (const char of text) {
    const f = fold(char, locale)
    for (let k = 0; k < f.length; k++) spans.push([pos, pos + char.length])
    folded += f
    pos += char.length
  }
  return {folded, spans}
}

/** Where `query` occurs in `text`, ignoring case and diacritics; ranges point into the original `text`. */
export function findMatches(text: string, query: string, locale: string): [number, number][] {
  const needle = index(query.trim(), locale).folded
  if (!needle) return []
  const {folded, spans} = index(text, locale)
  const out: [number, number][] = []
  let from = 0
  for (;;) {
    const at = folded.indexOf(needle, from)
    if (at === -1) return out
    const first = spans[at]
    const last = spans[at + needle.length - 1]
    if (first && last) out.push([first[0], last[1]])
    from = at + needle.length
  }
}
