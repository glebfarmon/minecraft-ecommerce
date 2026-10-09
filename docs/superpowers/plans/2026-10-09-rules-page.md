# Rules Page (Site Content, Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a finished `/rules` page (EN + PL) with numbered sections, contents with scroll highlight, locale-aware search, per-rule "copy text" and "copy link", anchors, and route brand values through `getSiteSettings()`, all on local data behind the read interface phase 2 will back with the API.

**Architecture:** Everything lives in `apps/web`. `features/rules/` owns types, demo data, pure helpers (numbering, mini-markdown, search) and client components; `getRules(locale)` and `getSiteSettings()` return local data now and keep their signatures in phase 2. The route `app/[locale]/rules/page.tsx` is a Server Component that numbers the rules and hands them to one client view (`RulesView`) holding the search state.

**Tech Stack:** Next.js 16 App Router, React 19 + React Compiler, next-intl 4, Tailwind 4, Motion (`MorphPopover`), lucide-react, Jest + Testing Library (jsdom), Playwright (e2e via docker compose).

**Spec:** `docs/superpowers/specs/2026-10-09-site-content-design.md` (phase 1 = §6.1, §6.4, §6.5, §9 "Phase 1").

## Global Constraints

- Business logic only in `apps/api`; `apps/web` gets no route handlers (CLAUDE.md).
- Frontend layout per ADR 0004/0005: `features/<name>/`, `components/`, `hooks/`, `lib/`, `config/` (lowest layer, imports nothing from `features/` or `app/`); imports flow shared → features → app; no barrels; absolute `@/…` imports.
- Anything that expands from a button into a panel uses `MorphPopover` (`apps/web/src/components/morph-popover.tsx`).
- No new dependencies in phase 1. Do not bump ESLint (9) or TypeScript (6) majors.
- `messages/pl.json` must keep exactly the keys of `messages/en.json` (`src/i18n/messages.test.ts`).
- Every namespace used by `useTranslations` in a `'use client'` file must be in `CLIENT_NAMESPACES` (`src/i18n/client-messages.test.ts`).
- Links on the page: EN has no locale prefix (`localePrefix: 'as-needed'`): `/rules`, PL: `/pl/rules`.
- Anchors: section `s-<n>`, item `r-<n>-<m>` (positional numbers).
- Copy feedback duration: `COPIED_FLASH_MS` from `@/config/cart` (1500 ms).
- Mini-markdown: only `**bold**`, `*italic*`, `[text](url)`; links only `https://…` or `/…` (not `//…`); never raw HTML.
- TDD: failing test first. Before every commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (repo root).
- Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `graphify query "<question>"` before grepping; run `graphify update .` after editing code (include this line in every subagent prompt).
- Unit test command (repo root): `pnpm --filter @shop/web exec jest <path>`.

## Review Focus

1. **Phone width (375 px) with long words or URLs in a rule** → no horizontal page scroll; text wraps. Pinned by the e2e "no horizontal scroll" test in Task 10 and `min-w-0 break-words` in Task 7.
2. **Search for characters with regex meaning (`(`, `*`, `.`, `+`)** → treated literally, no crash. Pinned by a unit test in Task 3.
3. **Whitespace-only query** → behaves as an empty search (all rules shown, nothing highlighted). Pinned in Task 3.
4. **`Ctrl+/` / `Cmd+/` (browser and screen-reader shortcuts)** → not hijacked by the search shortcut. Pinned in Task 8.
5. **Edition date near midnight in a non-UTC server time zone** → the date never shifts a day. Pinned by formatting with `timeZone: 'UTC'` and a noon timestamp (Task 4) and the e2e date check in Task 10.

---

## File map

| File (under `apps/web/src/` unless noted)               | Responsibility                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `features/rules/types.ts`                               | `RulesSource`, `Localized`, `PublicRules`, `RuleSection`, `RuleItem` |
| `features/rules/lib/number-rules.ts`                    | positional numbers and anchors                                       |
| `features/rules/lib/inline-markdown.ts`                 | mini-markdown tokens, plain text                                     |
| `features/rules/lib/normalize-search.ts`                | locale + diacritic-insensitive matching with original ranges         |
| `features/rules/lib/filter-rules.ts`                    | section/item filtering by query                                      |
| `features/rules/data/rules.en.ts`, `rules.pl.ts`        | demo rules                                                           |
| `features/rules/api/get-rules.ts`                       | read interface (local now, API in phase 2)                           |
| `features/rules/components/rich-text.tsx`               | renders tokens                                                       |
| `features/rules/components/highlight.tsx`               | `<mark>` around matches                                              |
| `features/rules/hooks/use-copy.ts`                      | clipboard write with copied/failed status                            |
| `features/rules/components/rule-actions.tsx`            | copy text / copy link buttons + live region                          |
| `features/rules/components/rule-row.tsx`                | one numbered rule                                                    |
| `features/rules/components/rules-section.tsx`           | section card                                                         |
| `features/rules/hooks/use-active-section.ts`            | section in view                                                      |
| `features/rules/components/rules-toc.tsx`               | contents list                                                        |
| `features/rules/components/rules-search.tsx`            | search input with `/` shortcut                                       |
| `features/rules/components/rules-view.tsx`              | client composition: search state, filter, layout, mobile popover     |
| `app/[locale]/rules/page.tsx`                           | route, header, metadata, footer                                      |
| `features/site-settings/api/get-site-settings.ts`       | brand settings read interface                                        |
| `config/site.ts`                                        | `SiteSettings`, `DEFAULT_SITE_SETTINGS`                              |
| `messages/en.json`, `messages/pl.json` (in `apps/web/`) | `rules` namespace                                                    |
| `e2e/tests/rules.spec.ts` (repo root)                   | browser checks                                                       |

---

### Task 1: Rules types and numbering

**Files:**

- Create: `apps/web/src/features/rules/types.ts`
- Create: `apps/web/src/features/rules/lib/number-rules.ts`
- Test: `apps/web/src/features/rules/lib/number-rules.test.ts`

**Interfaces:**

- Consumes: `Locale` from `@/i18n/routing`.
- Produces:
  - `type RulesSource = {publishedAt: string; sections: {id: string; title: string; items: {id: string; text: string}[]}[]}`
  - `type Localized = {value: string; lang: Locale}`
  - `type PublicRules = {publishedAt: string; sections: {id: string; title: Localized; items: {id: string; text: Localized}[]}[]}`
  - `type RuleItem = {id: string; number: string; anchor: string; text: Localized}`
  - `type RuleSection = {id: string; number: number; anchor: string; title: Localized; items: RuleItem[]}`
  - `sectionAnchor(n: number): string`, `itemAnchor(n: number, m: number): string`, `numberRules(rules: PublicRules): RuleSection[]`

- [ ] **Step 1: Write the types**

```ts
// apps/web/src/features/rules/types.ts
import type {Locale} from '@/i18n/routing'

/** Rules as an editor writes them, in one language. */
export type RulesSource = {
  /** ISO timestamp of the published edition. */
  publishedAt: string
  sections: {id: string; title: string; items: {id: string; text: string}[]}[]
}

/** A text and the language it is actually in (EN when a PL text fell back). */
export type Localized = {value: string; lang: Locale}

/** Shape of `GET /api/content/rules?locale=` (spec §5); `getRules` returns it in both phases. */
export type PublicRules = {
  publishedAt: string
  sections: {id: string; title: Localized; items: {id: string; text: Localized}[]}[]
}

export type RuleItem = {id: string; number: string; anchor: string; text: Localized}

export type RuleSection = {
  id: string
  number: number
  anchor: string
  title: Localized
  items: RuleItem[]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/web/src/features/rules/lib/number-rules.test.ts
import type {PublicRules} from '@/features/rules/types'

import {itemAnchor, numberRules, sectionAnchor} from './number-rules'

const en = (value: string) => ({value, lang: 'en' as const})

const rules: PublicRules = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {id: 'general', title: en('General'), items: [{id: 'g1', text: en('One')}]},
    {
      id: 'chat',
      title: en('Chat'),
      items: [
        {id: 'c1', text: en('Two')},
        {id: 'c2', text: en('Three')}
      ]
    }
  ]
}

describe('numberRules', () => {
  it('numbers sections and items by position', () => {
    const sections = numberRules(rules)
    expect(sections.map(s => s.number)).toEqual([1, 2])
    expect(sections[1]?.items.map(i => i.number)).toEqual(['2.1', '2.2'])
  })

  it('derives anchors from the numbers', () => {
    const sections = numberRules(rules)
    expect(sections[1]?.anchor).toBe('s-2')
    expect(sections[1]?.items[1]?.anchor).toBe('r-2-2')
  })

  it('keeps ids and localized texts', () => {
    const item = numberRules(rules)[1]?.items[0]
    expect(item).toEqual({id: 'c1', number: '2.1', anchor: 'r-2-1', text: en('Two')})
  })

  it('exposes the anchor helpers', () => {
    expect(sectionAnchor(3)).toBe('s-3')
    expect(itemAnchor(3, 12)).toBe('r-3-12')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/number-rules.test.ts`
Expected: FAIL, "Cannot find module './number-rules'".

- [ ] **Step 4: Implement**

```ts
// apps/web/src/features/rules/lib/number-rules.ts
import type {PublicRules, RuleSection} from '@/features/rules/types'

export const sectionAnchor = (n: number) => `s-${n}`
export const itemAnchor = (n: number, m: number) => `r-${n}-${m}`

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
        number: `${n}.${j + 1}`,
        anchor: itemAnchor(n, j + 1),
        text: item.text
      }))
    }
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/number-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): rules types and positional numbering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mini-markdown parser and `RichText`

**Files:**

- Create: `apps/web/src/features/rules/lib/inline-markdown.ts`
- Create: `apps/web/src/features/rules/components/rich-text.tsx`
- Test: `apps/web/src/features/rules/lib/inline-markdown.test.ts`, `apps/web/src/features/rules/components/rich-text.test.tsx`

**Interfaces:**

- Produces:
  - `type Inline = {type: 'text' | 'strong' | 'em'; value: string} | {type: 'link'; value: string; href: string}`
  - `parseInline(source: string): Inline[]`
  - `toPlainText(tokens: Inline[]): string`
  - `RichText({text, mark}: {text: string; mark?: (value: string) => ReactNode})`: renders tokens; `mark` wraps every text run (used for search highlight).

- [ ] **Step 1: Write the failing parser test**

```ts
// apps/web/src/features/rules/lib/inline-markdown.test.ts
import {parseInline, toPlainText} from './inline-markdown'

describe('parseInline', () => {
  it('returns plain text as one token', () => {
    expect(parseInline('No spam.')).toEqual([{type: 'text', value: 'No spam.'}])
  })

  it('parses bold, italic and links in order', () => {
    expect(parseInline('**No** *cheats*, see [refunds](/legal/refunds.en.pdf).')).toEqual([
      {type: 'strong', value: 'No'},
      {type: 'text', value: ' '},
      {type: 'em', value: 'cheats'},
      {type: 'text', value: ', see '},
      {type: 'link', value: 'refunds', href: '/legal/refunds.en.pdf'},
      {type: 'text', value: '.'}
    ])
  })

  it('keeps https links', () => {
    expect(parseInline('[Discord](https://discord.com)')).toEqual([
      {type: 'link', value: 'Discord', href: 'https://discord.com'}
    ])
  })

  it.each(['javascript:alert(1)', 'http://example.com', '//evil.example', 'data:text/html,x'])(
    'turns a link to %s into its plain label',
    href => {
      expect(parseInline(`[click](${href})`)).toEqual([{type: 'text', value: 'click'}])
    }
  )

  it('leaves HTML as literal text', () => {
    expect(parseInline('<b>x</b>')).toEqual([{type: 'text', value: '<b>x</b>'}])
  })

  it('leaves a lone asterisk alone', () => {
    expect(parseInline('2 * 3')).toEqual([{type: 'text', value: '2 * 3'}])
  })
})

describe('toPlainText', () => {
  it('drops markup and URLs but keeps link labels', () => {
    expect(toPlainText(parseInline('**Bold** and [Discord](https://discord.com).'))).toBe(
      'Bold and Discord.'
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/inline-markdown.test.ts`
Expected: FAIL, "Cannot find module './inline-markdown'".

- [ ] **Step 3: Implement the parser**

```ts
// apps/web/src/features/rules/lib/inline-markdown.ts
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
```

- [ ] **Step 4: Run the parser test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/inline-markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component test**

```tsx
// apps/web/src/features/rules/components/rich-text.test.tsx
import {render, screen} from '@testing-library/react'

import {RichText} from './rich-text'

describe('RichText', () => {
  it('renders bold, italic and links', () => {
    const {container} = render(
      <p>
        <RichText text="**No** *cheats*, ask on [Discord](https://discord.com)." />
      </p>
    )
    expect(container.querySelector('strong')).toHaveTextContent('No')
    expect(container.querySelector('em')).toHaveTextContent('cheats')
    const link = screen.getByRole('link', {name: 'Discord'})
    expect(link).toHaveAttribute('href', 'https://discord.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('opens site links in the same tab', () => {
    render(<RichText text="[refunds](/legal/refunds.en.pdf)" />)
    expect(screen.getByRole('link', {name: 'refunds'})).not.toHaveAttribute('target')
  })

  it('never renders HTML from the text', () => {
    const {container} = render(<RichText text="<img src=x onerror=alert(1)>" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>')
  })

  it('passes every text run through mark', () => {
    const {container} = render(
      <RichText text="**Bold** rest" mark={value => <i data-marked>{value}</i>} />
    )
    expect(container.querySelectorAll('[data-marked]')).toHaveLength(2)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rich-text.test.tsx`
Expected: FAIL, "Cannot find module './rich-text'".

- [ ] **Step 7: Implement the component**

```tsx
// apps/web/src/features/rules/components/rich-text.tsx
import {parseInline} from '@/features/rules/lib/inline-markdown'
import type {ReactNode} from 'react'
import {Fragment} from 'react'

const identity = (value: string): ReactNode => value

/** Renders rule mini-markdown. `mark` wraps each text run, so search can highlight inside bold or links. */
export function RichText({
  text,
  mark = identity
}: {
  text: string
  mark?: (value: string) => ReactNode
}) {
  return parseInline(text).map((token, i) => {
    switch (token.type) {
      case 'strong':
        return (
          <strong key={i} className="text-fg font-semibold">
            {mark(token.value)}
          </strong>
        )
      case 'em':
        return <em key={i}>{mark(token.value)}</em>
      case 'link': {
        const external = token.href.startsWith('https://')
        return (
          <a
            key={i}
            href={token.href}
            className="text-accent hover:text-fg underline underline-offset-2"
            {...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>
            {mark(token.value)}
          </a>
        )
      }
      default:
        return <Fragment key={i}>{mark(token.value)}</Fragment>
    }
  })
}
```

- [ ] **Step 8: Run both tests**

Run: `pnpm --filter @shop/web exec jest src/features/rules`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): safe mini-markdown for rule texts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Locale-aware search, filter and highlight

**Files:**

- Create: `apps/web/src/features/rules/lib/normalize-search.ts`
- Create: `apps/web/src/features/rules/lib/filter-rules.ts`
- Create: `apps/web/src/features/rules/components/highlight.tsx`
- Test: `apps/web/src/features/rules/lib/normalize-search.test.ts`, `apps/web/src/features/rules/lib/filter-rules.test.ts`, `apps/web/src/features/rules/components/highlight.test.tsx`

**Interfaces:**

- Consumes: `RuleSection` (Task 1), `parseInline`, `toPlainText` (Task 2).
- Produces:
  - `findMatches(text: string, query: string, locale: string): [number, number][]`: `[start, end)` ranges in the original `text`.
  - `filterRules(sections: RuleSection[], query: string, locale: string): RuleSection[]`
  - `Highlight({text, query, locale}: {text: string; query: string; locale: string})`

- [ ] **Step 1: Write the failing matcher test**

```ts
// apps/web/src/features/rules/lib/normalize-search.test.ts
import {findMatches} from './normalize-search'

describe('findMatches', () => {
  it('ignores case', () => {
    expect(findMatches('Chat rules', 'CHAT', 'en')).toEqual([[0, 4]])
  })

  it('ignores Polish diacritics, including ł', () => {
    expect(findMatches('Złośliwe oprogramowanie', 'zlosliwe', 'pl')).toEqual([[0, 8]])
    expect(findMatches('ŻÓŁW', 'zolw', 'pl')).toEqual([[0, 4]])
  })

  it('maps ranges back to the original text', () => {
    const text = 'Żółw i żółw'
    const ranges = findMatches(text, 'zolw', 'pl')
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual(['Żółw', 'żółw'])
  })

  it('treats regex characters literally', () => {
    expect(findMatches('a (b) * c.', '(b) *', 'en')).toEqual([[2, 7]])
    expect(findMatches('abc', '.', 'en')).toEqual([])
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(findMatches('anything', '', 'en')).toEqual([])
    expect(findMatches('anything', '   ', 'en')).toEqual([])
  })

  it('trims the query', () => {
    expect(findMatches('no spam', ' spam ', 'en')).toEqual([[3, 7]])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/normalize-search.test.ts`
Expected: FAIL, "Cannot find module './normalize-search'".

- [ ] **Step 3: Implement the matcher**

```ts
// apps/web/src/features/rules/lib/normalize-search.ts

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
```

- [ ] **Step 4: Run the matcher test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/normalize-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing filter test**

```ts
// apps/web/src/features/rules/lib/filter-rules.test.ts
import type {RuleSection} from '@/features/rules/types'

import {filterRules} from './filter-rules'

const pl = (value: string) => ({value, lang: 'pl' as const})

const sections: RuleSection[] = [
  {
    id: 'chat',
    number: 1,
    anchor: 's-1',
    title: pl('Czat'),
    items: [
      {id: 'c1', number: '1.1', anchor: 'r-1-1', text: pl('**Obelgi** są zabronione.')},
      {id: 'c2', number: '1.2', anchor: 'r-1-2', text: pl('Zakaz spamu.')}
    ]
  },
  {
    id: 'cheats',
    number: 2,
    anchor: 's-2',
    title: pl('Sprawdzanie na cheaty'),
    items: [{id: 'x1', number: '2.1', anchor: 'r-2-1', text: pl('**Złośliwe** oprogramowanie.')}]
  }
]

describe('filterRules', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterRules(sections, '', 'pl')).toBe(sections)
    expect(filterRules(sections, '  ', 'pl')).toBe(sections)
  })

  it('keeps only matching items, searching the visible text', () => {
    const result = filterRules(sections, 'zlosliwe', 'pl')
    expect(result.map(s => s.id)).toEqual(['cheats'])
    expect(result[0]?.items.map(i => i.id)).toEqual(['x1'])
  })

  it('does not match markdown syntax', () => {
    expect(filterRules(sections, '**', 'pl')).toEqual([])
  })

  it('keeps a whole section when its title matches', () => {
    const result = filterRules(sections, 'czat', 'pl')
    expect(result[0]?.items).toHaveLength(2)
  })

  it('finds an item by its number', () => {
    const result = filterRules(sections, '1.2', 'pl')
    expect(result[0]?.items.map(i => i.id)).toEqual(['c2'])
  })

  it('drops sections without matches', () => {
    expect(filterRules(sections, 'nothing here', 'pl')).toEqual([])
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/lib/filter-rules.test.ts`
Expected: FAIL, "Cannot find module './filter-rules'".

- [ ] **Step 7: Implement the filter**

```ts
// apps/web/src/features/rules/lib/filter-rules.ts
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
```

- [ ] **Step 8: Write the failing highlight test**

```tsx
// apps/web/src/features/rules/components/highlight.test.tsx
import {render} from '@testing-library/react'

import {Highlight} from './highlight'

describe('Highlight', () => {
  it('wraps every match in <mark>, keeping the original letters', () => {
    const {container} = render(<Highlight text="Żółw i żółw" query="zolw" locale="pl" />)
    const marks = [...container.querySelectorAll('mark')].map(m => m.textContent)
    expect(marks).toEqual(['Żółw', 'żółw'])
    expect(container).toHaveTextContent('Żółw i żółw')
  })

  it('renders plain text without a query', () => {
    const {container} = render(<Highlight text="No spam" query="" locale="en" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container).toHaveTextContent('No spam')
  })
})
```

- [ ] **Step 9: Implement `Highlight`**

```tsx
// apps/web/src/features/rules/components/highlight.tsx
import {findMatches} from '@/features/rules/lib/normalize-search'
import type {ReactNode} from 'react'

export function Highlight({text, query, locale}: {text: string; query: string; locale: string}) {
  const matches = findMatches(text, query, locale)
  if (matches.length === 0) return text
  const parts: ReactNode[] = []
  let last = 0
  matches.forEach(([start, end], i) => {
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={i} className="bg-accent-soft text-fg rounded-sm">
        {text.slice(start, end)}
      </mark>
    )
    last = end
  })
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
```

- [ ] **Step 10: Run all three tests**

Run: `pnpm --filter @shop/web exec jest src/features/rules`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): diacritic-insensitive rules search with highlight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Demo rules (EN, PL) and `getRules`

**Files:**

- Create: `apps/web/src/features/rules/data/rules.en.ts`, `apps/web/src/features/rules/data/rules.pl.ts`
- Create: `apps/web/src/features/rules/api/get-rules.ts`
- Test: `apps/web/src/features/rules/data/rules.test.ts`, `apps/web/src/features/rules/api/get-rules.test.ts`

**Interfaces:**

- Consumes: `RulesSource`, `PublicRules` (Task 1); `parseInline` (Task 2).
- Produces: `getRules(locale: Locale): Promise<PublicRules | null>`. Phase 2 keeps this exact signature.

Section sizes are chosen so the PL plural forms all appear on the page: 4, 3, 3, **5**, 4, 3 items (`punkty`, `punktów`).

- [ ] **Step 1: Write the failing data test**

```ts
// apps/web/src/features/rules/data/rules.test.ts
import {parseInline} from '@/features/rules/lib/inline-markdown'

import {RULES_EN} from './rules.en'
import {RULES_PL} from './rules.pl'

const shape = (rules: typeof RULES_EN) =>
  rules.sections.map(s => ({id: s.id, items: s.items.map(i => i.id)}))

describe('demo rules', () => {
  it('have the same sections and items in EN and PL', () => {
    expect(shape(RULES_PL)).toEqual(shape(RULES_EN))
  })

  it('share one edition date, at noon UTC so no time zone shifts the day', () => {
    expect(RULES_PL.publishedAt).toBe(RULES_EN.publishedAt)
    expect(RULES_EN.publishedAt).toMatch(/T12:00:00Z$/)
  })

  it.each([
    ['en', RULES_EN],
    ['pl', RULES_PL]
  ])('%s has no empty texts and only safe links', (_, rules) => {
    for (const section of rules.sections) {
      expect(section.title.trim()).not.toBe('')
      for (const item of section.items) {
        expect(item.text.trim()).not.toBe('')
        // A `[label](href)` written in the text must survive as a link, not degrade to its label.
        const written = (item.text.match(/\]\(/g) ?? []).length
        expect(parseInline(item.text).filter(t => t.type === 'link')).toHaveLength(written)
      }
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/data/rules.test.ts`
Expected: FAIL, "Cannot find module './rules.en'".

- [ ] **Step 3: Write the EN data**

```ts
// apps/web/src/features/rules/data/rules.en.ts
import type {RulesSource} from '@/features/rules/types'

// Demo rules until the content API exists (spec §9, phase 2 seeds them as the first published version).
export const RULES_EN: RulesSource = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {
      id: 'general',
      title: 'General',
      items: [
        {id: 'general-1', text: 'Not knowing the rules does not free you from responsibility.'},
        {id: 'general-2', text: 'By joining the server you accept these rules in full.'},
        {
          id: 'general-3',
          text: 'Staff may punish behaviour that harms other players even if no rule names it.'
        },
        {
          id: 'general-4',
          text: 'Rules can change; the edition date at the top of this page shows the current version.'
        }
      ]
    },
    {
      id: 'chat',
      title: 'Chat',
      items: [
        {
          id: 'chat-1',
          text: 'Be respectful. **Insults, threats and hate speech** are not allowed.'
        },
        {id: 'chat-2', text: 'No spam, flood or caps lock in public chat.'},
        {id: 'chat-3', text: 'Advertising other servers or services is forbidden.'}
      ]
    },
    {
      id: 'account',
      title: 'Account and nickname',
      items: [
        {id: 'account-1', text: 'You are responsible for everything done from your account.'},
        {id: 'account-2', text: 'Nicknames must not be offensive or imitate staff.'},
        {id: 'account-3', text: 'Sharing or selling accounts is not allowed.'}
      ]
    },
    {
      id: 'gameplay',
      title: 'Gameplay',
      items: [
        {id: 'gameplay-1', text: 'Do not exploit bugs; report them to staff instead.'},
        {id: 'gameplay-2', text: 'Griefing in protected areas is forbidden.'},
        {
          id: 'gameplay-3',
          text: 'Lag machines and builds that overload the server are removed without warning.'
        },
        {id: 'gameplay-4', text: 'Scamming in trades is punished like theft.'},
        {id: 'gameplay-5', text: 'Building within 50 blocks of spawn is not allowed.'}
      ]
    },
    {
      id: 'cheats',
      title: 'Cheat checks',
      items: [
        {id: 'cheats-1', text: 'Cheat clients, macros and *X-ray* resource packs are forbidden.'},
        {
          id: 'cheats-2',
          text: 'During a check you must follow staff instructions and stay online.'
        },
        {
          id: 'cheats-3',
          text: 'Refusing a check or leaving during it counts as admitting to cheating.'
        },
        {
          id: 'cheats-4',
          text: '**Malicious software** found on your computer means a permanent ban.'
        }
      ]
    },
    {
      id: 'paid',
      title: 'Paid services',
      items: [
        {
          id: 'paid-1',
          text: 'Purchases are delivered automatically; see the [refund policy](/legal/refunds.en.pdf) for exceptions.'
        },
        {id: 'paid-2', text: 'Paid ranks do not exempt you from these rules.'},
        {id: 'paid-3', text: 'Questions about payments go to our [Discord](https://discord.com).'}
      ]
    }
  ]
}
```

- [ ] **Step 4: Write the PL data**

```ts
// apps/web/src/features/rules/data/rules.pl.ts
import type {RulesSource} from '@/features/rules/types'

export const RULES_PL: RulesSource = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {
      id: 'general',
      title: 'Postanowienia ogólne',
      items: [
        {id: 'general-1', text: 'Nieznajomość zasad nie zwalnia z odpowiedzialności.'},
        {id: 'general-2', text: 'Dołączając do serwera, akceptujesz te zasady w całości.'},
        {
          id: 'general-3',
          text: 'Administracja może ukarać zachowanie szkodzące innym graczom, nawet jeśli żadna zasada go nie wymienia.'
        },
        {
          id: 'general-4',
          text: 'Zasady mogą się zmieniać; data wersji na górze strony pokazuje aktualne brzmienie.'
        }
      ]
    },
    {
      id: 'chat',
      title: 'Czat',
      items: [
        {id: 'chat-1', text: 'Szanuj innych. **Obelgi, groźby i mowa nienawiści** są zabronione.'},
        {id: 'chat-2', text: 'Zakaz spamu, floodu i pisania caps lockiem na czacie publicznym.'},
        {id: 'chat-3', text: 'Reklamowanie innych serwerów lub usług jest zabronione.'}
      ]
    },
    {
      id: 'account',
      title: 'Konto i nick',
      items: [
        {id: 'account-1', text: 'Odpowiadasz za wszystko, co dzieje się na Twoim koncie.'},
        {id: 'account-2', text: 'Nick nie może być obraźliwy ani podszywać się pod administrację.'},
        {id: 'account-3', text: 'Udostępnianie i sprzedaż kont są zabronione.'}
      ]
    },
    {
      id: 'gameplay',
      title: 'Rozgrywka',
      items: [
        {id: 'gameplay-1', text: 'Nie wykorzystuj błędów; zgłaszaj je administracji.'},
        {
          id: 'gameplay-2',
          text: 'Niszczenie cudzych budowli na chronionych terenach jest zabronione.'
        },
        {
          id: 'gameplay-3',
          text: 'Maszyny lagujące i budowle przeciążające serwer są usuwane bez ostrzeżenia.'
        },
        {id: 'gameplay-4', text: 'Oszustwa w handlu są karane jak kradzież.'},
        {id: 'gameplay-5', text: 'Budowanie w promieniu 50 bloków od spawnu jest zabronione.'}
      ]
    },
    {
      id: 'cheats',
      title: 'Sprawdzanie na cheaty',
      items: [
        {id: 'cheats-1', text: 'Zabronione są cheaty, makra i paczki zasobów typu *X-ray*.'},
        {
          id: 'cheats-2',
          text: 'Podczas sprawdzania musisz wykonywać polecenia administracji i pozostać online.'
        },
        {
          id: 'cheats-3',
          text: 'Odmowa sprawdzenia lub wyjście w jego trakcie oznacza przyznanie się do cheatowania.'
        },
        {
          id: 'cheats-4',
          text: '**Złośliwe oprogramowanie** wykryte na Twoim komputerze oznacza bana na stałe.'
        }
      ]
    },
    {
      id: 'paid',
      title: 'Usługi płatne',
      items: [
        {
          id: 'paid-1',
          text: 'Zakupy są dostarczane automatycznie; wyjątki opisuje [polityka zwrotów](/legal/refunds.pl.pdf).'
        },
        {id: 'paid-2', text: 'Płatne rangi nie zwalniają z przestrzegania zasad.'},
        {
          id: 'paid-3',
          text: 'Pytania o płatności zadawaj na naszym [Discordzie](https://discord.com).'
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Run the data test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/data/rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing `getRules` test**

```ts
// apps/web/src/features/rules/api/get-rules.test.ts
import {getRules} from './get-rules'

describe('getRules', () => {
  it.each(['en', 'pl'] as const)('returns %s rules tagged with their language', async locale => {
    const rules = await getRules(locale)
    expect(rules?.publishedAt).toBe('2026-05-28T12:00:00Z')
    expect(rules?.sections).toHaveLength(6)
    expect(rules?.sections[0]?.title.lang).toBe(locale)
    expect(rules?.sections[0]?.items[0]?.text.lang).toBe(locale)
  })

  it('returns PL texts for PL', async () => {
    const rules = await getRules('pl')
    expect(rules?.sections[1]?.title.value).toBe('Czat')
  })
})
```

- [ ] **Step 7: Implement `getRules`**

```ts
// apps/web/src/features/rules/api/get-rules.ts
import {RULES_EN} from '@/features/rules/data/rules.en'
import {RULES_PL} from '@/features/rules/data/rules.pl'
import type {PublicRules, RulesSource} from '@/features/rules/types'
import type {Locale} from '@/i18n/routing'

const SOURCES: Record<Locale, RulesSource> = {en: RULES_EN, pl: RULES_PL}

/**
 * Published rules for `locale`, or `null` when nothing is published.
 * Phase 1 reads the demo files; phase 2 fetches `/api/content/rules` behind `'use cache'` (spec §6.2)
 * and keeps this signature.
 */
export function getRules(locale: Locale): Promise<PublicRules | null> {
  const source = SOURCES[locale]
  return Promise.resolve({
    publishedAt: source.publishedAt,
    sections: source.sections.map(section => ({
      id: section.id,
      title: {value: section.title, lang: locale},
      items: section.items.map(item => ({id: item.id, text: {value: item.text, lang: locale}}))
    }))
  })
}
```

- [ ] **Step 8: Run the folder**

Run: `pnpm --filter @shop/web exec jest src/features/rules`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): demo rules in EN and PL behind getRules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `rules` messages (EN, PL)

**Files:**

- Modify: `apps/web/messages/en.json`, `apps/web/messages/pl.json` (add top-level `rules` object after `faq`)
- Modify: `apps/web/src/i18n/client-messages.ts` (`CLIENT_NAMESPACES`)
- Test: `apps/web/src/i18n/messages.test.ts`

**Interfaces:**

- Produces: next-intl keys `rules.title` (rich, `<accent>`), `rules.lead`, `rules.metaTitle`, `rules.metaDescription`, `rules.edition` (`{date}`), `rules.contents`, `rules.openContents`, `rules.closeContents`, `rules.searchLabel`, `rules.searchPlaceholder`, `rules.searchShortcut`, `rules.clearSearch`, `rules.itemCount` (`{count}` plural), `rules.noResults` (`{query}`), `rules.unavailable`, `rules.copyText` (`{number}`), `rules.copyLink` (`{number}`), `rules.copied`, `rules.linkCopied`, `rules.copyFailed`.

- [ ] **Step 1: Write the failing plural test**

Add to `apps/web/src/i18n/messages.test.ts`, inside `describe('messages', …)`:

```ts
it.each([
  ['en', en],
  ['pl', pl]
] as const)('%s rules.itemCount has a branch for every plural category', (locale, messages) => {
  const text = (messages as {rules?: {itemCount?: string}}).rules?.itemCount ?? ''
  const {pluralCategories} = new Intl.PluralRules(locale).resolvedOptions() as {
    pluralCategories: string[]
  }
  for (const category of pluralCategories) expect(text).toContain(`${category} {`)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/i18n/messages.test.ts`
Expected: FAIL on both cases (`rules` missing, `''` does not contain `one {`).

- [ ] **Step 3: Add the EN namespace** (in `apps/web/messages/en.json`, as a new top-level key after `"faq"`)

```json
  "rules": {
    "title": "Server <accent>rules</accent>",
    "lead": "By playing on our servers you agree to all of the rules below.",
    "metaTitle": "Server rules — Blockhaus",
    "metaDescription": "The rules of the Blockhaus Minecraft servers: chat, accounts, gameplay, cheat checks and paid services.",
    "edition": "Current edition: {date}",
    "contents": "Contents",
    "openContents": "Show contents",
    "closeContents": "Close contents",
    "searchLabel": "Search the rules",
    "searchPlaceholder": "Search the rules…",
    "searchShortcut": "Press / to search",
    "clearSearch": "Clear search",
    "itemCount": "{count, plural, one {# item} other {# items}}",
    "noResults": "No rules match “{query}”",
    "unavailable": "The rules are temporarily unavailable. Please try again in a minute.",
    "copyText": "Copy rule {number}",
    "copyLink": "Copy link to rule {number}",
    "copied": "Rule copied",
    "linkCopied": "Link copied",
    "copyFailed": "Couldn't copy"
  },
```

- [ ] **Step 4: Add the PL namespace** (in `apps/web/messages/pl.json`, same position)

```json
  "rules": {
    "title": "Zasady <accent>serwera</accent>",
    "lead": "Grając na naszych serwerach, akceptujesz wszystkie poniższe zasady.",
    "metaTitle": "Zasady serwera — Blockhaus",
    "metaDescription": "Zasady serwerów Minecraft Blockhaus: czat, konta, rozgrywka, sprawdzanie na cheaty i usługi płatne.",
    "edition": "Obowiązująca wersja z {date}",
    "contents": "Spis treści",
    "openContents": "Pokaż spis treści",
    "closeContents": "Zamknij spis treści",
    "searchLabel": "Szukaj w zasadach",
    "searchPlaceholder": "Szukaj w zasadach…",
    "searchShortcut": "Naciśnij /, aby wyszukać",
    "clearSearch": "Wyczyść wyszukiwanie",
    "itemCount": "{count, plural, one {# punkt} few {# punkty} many {# punktów} other {# punktu}}",
    "noResults": "Brak zasad pasujących do „{query}”",
    "unavailable": "Zasady są chwilowo niedostępne. Spróbuj ponownie za minutę.",
    "copyText": "Kopiuj zasadę {number}",
    "copyLink": "Kopiuj link do zasady {number}",
    "copied": "Skopiowano zasadę",
    "linkCopied": "Skopiowano link",
    "copyFailed": "Nie udało się skopiować"
  },
```

- [ ] **Step 5: Ship the namespace to the client**

In `apps/web/src/i18n/client-messages.ts` add `'rules'` to `CLIENT_NAMESPACES` (after `'consent'`). `RulesView` and its children are Client Components (Tasks 6–9).

- [ ] **Step 6: Run the i18n tests**

Run: `pnpm --filter @shop/web exec jest src/i18n`
Expected: PASS (key parity, plural branches, client namespaces).

- [ ] **Step 7: Commit**

```bash
git add apps/web/messages apps/web/src/i18n
git commit -m "feat(web): rules page messages in EN and PL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Copy text / copy link

**Files:**

- Create: `apps/web/src/features/rules/hooks/use-copy.ts`
- Create: `apps/web/src/features/rules/components/rule-actions.tsx`
- Test: `apps/web/src/features/rules/components/rule-actions.test.tsx`

**Interfaces:**

- Consumes: `useTransientFlag(ms)` from `@/hooks/use-transient-flag` (returns `[on, trigger]`), `COPIED_FLASH_MS` from `@/config/cart`, messages from Task 5.
- Produces:
  - `type CopyStatus = 'idle' | 'copied' | 'failed'`; `useCopy(): {status: CopyStatus; copy: (text: string) => void}`
  - `RuleActions({number, plainText, href}: {number: string; plainText: string; href: string})`: `href` is the site path with hash, e.g. `/pl/rules#r-2-3`; the button builds the absolute URL from `window.location.origin`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/rules/components/rule-actions.test.tsx
import {act, fireEvent, render, screen} from '@testing-library/react'

import {RuleActions} from './rule-actions'

// next-intl is ESM-only; "key number" stands in for the translated text.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: {number?: string}) =>
    values?.number ? `${key} ${values.number}` : key
}))

const writeText = jest.fn()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true})
})

const status = () => screen.getByRole('status')

describe('RuleActions', () => {
  it('copies "number. plain text"', async () => {
    render(<RuleActions number="2.3" plainText="No spam." href="/pl/rules#r-2-3" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyText 2.3'}))
    })
    expect(writeText).toHaveBeenCalledWith('2.3. No spam.')
    expect(status()).toHaveTextContent('copied')
  })

  it.each([
    ['/rules#r-2-3', 'http://localhost/rules#r-2-3'],
    ['/pl/rules#r-2-3', 'http://localhost/pl/rules#r-2-3']
  ])('copies the absolute link for %s', async (href, url) => {
    render(<RuleActions number="2.3" plainText="No spam." href={href} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyLink 2.3'}))
    })
    expect(writeText).toHaveBeenCalledWith(url)
    expect(status()).toHaveTextContent('linkCopied')
  })

  it('announces a failure when the clipboard rejects', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyText 2.3'}))
    })
    expect(status()).toHaveTextContent('copyFailed')
  })

  it('announces a failure when there is no clipboard (plain http)', async () => {
    Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true})
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyLink 2.3'}))
    })
    expect(status()).toHaveTextContent('copyFailed')
  })

  it('clears the announcement after the flash', async () => {
    jest.useFakeTimers()
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyText 2.3'}))
    })
    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(status()).toHaveTextContent('')
    jest.useRealTimers()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rule-actions.test.tsx`
Expected: FAIL, "Cannot find module './rule-actions'".

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/src/features/rules/hooks/use-copy.ts
'use client'

import {COPIED_FLASH_MS} from '@/config/cart'
import {useTransientFlag} from '@/hooks/use-transient-flag'

export type CopyStatus = 'idle' | 'copied' | 'failed'

/** Writes to the clipboard and reports the outcome for `COPIED_FLASH_MS`. */
export function useCopy() {
  const [copied, flashCopied] = useTransientFlag(COPIED_FLASH_MS)
  const [failed, flashFailed] = useTransientFlag(COPIED_FLASH_MS)
  const copy = (text: string) => {
    // Missing outside secure contexts (plain http on a LAN address).
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (!clipboard) {
      flashFailed()
      return
    }
    clipboard.writeText(text).then(flashCopied, flashFailed)
  }
  const status: CopyStatus = copied ? 'copied' : failed ? 'failed' : 'idle'
  return {status, copy}
}
```

- [ ] **Step 4: Implement the component**

```tsx
// apps/web/src/features/rules/components/rule-actions.tsx
'use client'

import {type CopyStatus, useCopy} from '@/features/rules/hooks/use-copy'
import {Check, Copy, Link2, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

function ActionButton({
  label,
  status,
  icon,
  onClick
}: {
  label: string
  status: CopyStatus
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-status={status}
      onClick={onClick}
      className="text-muted hover:text-fg focus-visible:outline-accent data-[status=copied]:text-online data-[status=failed]:text-danger grid size-8 place-items-center rounded-full transition-colors hover:bg-white/5 focus-visible:outline-2">
      {status === 'copied' ? (
        <Check className="size-4" />
      ) : status === 'failed' ? (
        <X className="size-4" />
      ) : (
        icon
      )}
    </button>
  )
}

/** Shown on hover or keyboard focus of the rule (parent has `group`); always visible without hover. */
export function RuleActions({
  number,
  plainText,
  href
}: {
  number: string
  plainText: string
  /** Site path with the rule anchor, e.g. `/pl/rules#r-2-3`. */
  href: string
}) {
  const t = useTranslations('rules')
  const text = useCopy()
  const link = useCopy()

  const announcement =
    text.status === 'copied'
      ? t('copied')
      : link.status === 'copied'
        ? t('linkCopied')
        : text.status === 'failed' || link.status === 'failed'
          ? t('copyFailed')
          : ''

  return (
    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70">
      <ActionButton
        label={t('copyText', {number})}
        status={text.status}
        icon={<Copy className="size-4" />}
        onClick={() => {
          text.copy(`${number}. ${plainText}`)
        }}
      />
      <ActionButton
        label={t('copyLink', {number})}
        status={link.status}
        icon={<Link2 className="size-4" />}
        onClick={() => {
          link.copy(new URL(href, window.location.origin).toString())
        }}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rule-actions.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): copy rule text and link with announced feedback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rule row and section card

**Files:**

- Create: `apps/web/src/features/rules/components/rule-row.tsx`
- Create: `apps/web/src/features/rules/components/rules-section.tsx`
- Modify: `apps/web/src/app/globals.css` (animation token + keyframes)
- Test: `apps/web/src/features/rules/components/rules-section.test.tsx`

**Interfaces:**

- Consumes: `RuleItem`, `RuleSection` (Task 1); `RichText` (Task 2); `parseInline`, `toPlainText` (Task 2); `Highlight` (Task 3); `RuleActions` (Task 6).
- Produces:
  - `RuleRow({item, query, locale, rulesPath}: {item: RuleItem; query: string; locale: string; rulesPath: string})`
  - `RulesSection({section, query, locale, rulesPath}: {section: RuleSection; query: string; locale: string; rulesPath: string})`
  - Tailwind class `animate-rule-flash`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/rules/components/rules-section.test.tsx
import type {RuleSection} from '@/features/rules/types'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {RulesSection} from './rules-section'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(',')}` : key
}))

const section: RuleSection = {
  id: 'chat',
  number: 2,
  anchor: 's-2',
  title: {value: 'Czat', lang: 'pl'},
  items: [
    {
      id: 'c1',
      number: '2.1',
      anchor: 'r-2-1',
      text: {value: '**Obelgi** są zabronione.', lang: 'pl'}
    },
    {id: 'c2', number: '2.2', anchor: 'r-2-2', text: {value: 'No spam.', lang: 'en'}}
  ]
}

const setup = (query = '') =>
  render(<RulesSection section={section} query={query} locale="pl" rulesPath="/pl/rules" />)

describe('RulesSection', () => {
  it('renders the numbered heading, count and anchored items', () => {
    setup()
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('2. Czat')
    expect(screen.getByText('itemCount 2')).toBeInTheDocument()
    expect(document.getElementById('s-2')).not.toBeNull()
    expect(document.getElementById('r-2-1')).not.toBeNull()
    expect(screen.getByRole('link', {name: '2.1'})).toHaveAttribute('href', '#r-2-1')
  })

  it('marks a fallback text with its own language', () => {
    setup()
    expect(screen.getByText('No spam.')).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/są zabronione/).closest('[lang]')).toBeNull()
  })

  it('highlights matches inside formatted text', () => {
    const {container} = setup('obelgi')
    expect(container.querySelector('strong mark')).toHaveTextContent('Obelgi')
  })

  it('copies the plain text of a rule', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true})
    setup()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'copyText 2.1'}))
    })
    expect(writeText).toHaveBeenCalledWith('2.1. Obelgi są zabronione.')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rules-section.test.tsx`
Expected: FAIL, "Cannot find module './rules-section'".

- [ ] **Step 3: Implement `RuleRow`**

```tsx
// apps/web/src/features/rules/components/rule-row.tsx
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
      className="group target:animate-rule-flash flex scroll-mt-28 gap-4 rounded-xl px-4 py-4">
      <a
        href={`#${item.anchor}`}
        className="tabular text-accent w-10 shrink-0 pt-0.5 font-mono text-sm hover:underline">
        {item.number}
      </a>
      <p
        lang={item.text.lang === locale ? undefined : item.text.lang}
        className="text-fg/85 min-w-0 flex-1 leading-relaxed break-words">
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
```

- [ ] **Step 4: Implement `RulesSection`**

```tsx
// apps/web/src/features/rules/components/rules-section.tsx
'use client'

import {Highlight} from '@/features/rules/components/highlight'
import {RuleRow} from '@/features/rules/components/rule-row'
import type {RuleSection} from '@/features/rules/types'
import {BookOpen} from 'lucide-react'
import {useTranslations} from 'next-intl'

export function RulesSection({
  section,
  query,
  locale,
  rulesPath
}: {
  section: RuleSection
  query: string
  locale: string
  rulesPath: string
}) {
  const t = useTranslations('rules')
  const titleId = `${section.anchor}-title`
  return (
    <section
      id={section.anchor}
      aria-labelledby={titleId}
      className="border-border bg-surface/60 scroll-mt-28 overflow-hidden rounded-2xl border">
      <header className="border-border flex items-baseline justify-between gap-4 border-b px-6 py-5">
        <h2
          id={titleId}
          className="font-display flex min-w-0 items-baseline gap-3 text-xl font-bold tracking-wide uppercase">
          <BookOpen aria-hidden className="text-accent size-5 shrink-0 self-center" />
          <span className="text-accent">{section.number}.</span>{' '}
          <span
            lang={section.title.lang === locale ? undefined : section.title.lang}
            className="break-words">
            <Highlight text={section.title.value} query={query} locale={locale} />
          </span>
        </h2>
        <span className="tabular text-muted shrink-0 text-sm">
          {t('itemCount', {count: section.items.length})}
        </span>
      </header>
      <ol className="divide-line divide-y px-2 py-2">
        {section.items.map(item => (
          <RuleRow key={item.id} item={item} query={query} locale={locale} rulesPath={rulesPath} />
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 5: Add the flash animation** to `apps/web/src/app/globals.css`

Inside the first `@theme { … }` block (the one with `--color-bg`), add:

```css
--animate-rule-flash: rule-flash 2s ease-out;
```

Next to the other `@keyframes` (after `feed-marquee`), add:

```css
/* The rule a shared link points to (#r-2-3) glows once, then settles. */
@keyframes rule-flash {
  from {
    background-color: var(--color-accent-soft);
  }
  to {
    background-color: transparent;
  }
}
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rules-section.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/rules apps/web/src/app/globals.css
git commit -m "feat(web): rules section card with anchored, copyable rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Contents, active section and search input

**Files:**

- Create: `apps/web/src/features/rules/hooks/use-active-section.ts`
- Create: `apps/web/src/features/rules/components/rules-toc.tsx`
- Create: `apps/web/src/features/rules/components/rules-search.tsx`
- Test: `apps/web/src/features/rules/hooks/use-active-section.test.ts`, `apps/web/src/features/rules/components/rules-toc.test.tsx`, `apps/web/src/features/rules/components/rules-search.test.tsx`

**Interfaces:**

- Consumes: `RuleSection` (Task 1); messages (Task 5).
- Produces:
  - `useActiveSection(ids: string[]): string | undefined`
  - `RulesToc({sections, active, onNavigate}: {sections: RuleSection[]; active: string | undefined; onNavigate?: () => void})`
  - `RulesSearch({query, onQueryChange}: {query: string; onQueryChange: (query: string) => void})`

- [ ] **Step 1: Write the failing hook test**

```ts
// apps/web/src/features/rules/hooks/use-active-section.test.ts
import {act, renderHook} from '@testing-library/react'

import {useActiveSection} from './use-active-section'

let report: IntersectionObserverCallback = () => {}
const original = window.IntersectionObserver

beforeEach(() => {
  window.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      report = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
  document.body.innerHTML = '<section id="s-1"></section><section id="s-2"></section>'
})

afterEach(() => {
  window.IntersectionObserver = original
  document.body.innerHTML = ''
})

const entry = (id: string, isIntersecting: boolean) =>
  ({target: document.getElementById(id), isIntersecting}) as unknown as IntersectionObserverEntry

const fire = (...entries: IntersectionObserverEntry[]) => {
  act(() => {
    report(entries, {} as IntersectionObserver)
  })
}

describe('useActiveSection', () => {
  it('starts on the first section', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    expect(result.current).toBe('s-1')
  })

  it('follows the first section in the reading band', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    fire(entry('s-1', false), entry('s-2', true))
    expect(result.current).toBe('s-2')
  })

  it('keeps the last section while none is in the band', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    fire(entry('s-2', true))
    fire(entry('s-2', false))
    expect(result.current).toBe('s-2')
  })

  it('falls back to the first id when the active one is filtered out', () => {
    const {result, rerender} = renderHook(({ids}) => useActiveSection(ids), {
      initialProps: {ids: ['s-1', 's-2']}
    })
    fire(entry('s-2', true))
    rerender({ids: ['s-1']})
    expect(result.current).toBe('s-1')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/hooks/use-active-section.test.ts`
Expected: FAIL, "Cannot find module './use-active-section'".

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/src/features/rules/hooks/use-active-section.ts
'use client'

import {useEffect, useState} from 'react'

/** The section being read: the first one (in document order) crossing a band near the top of the viewport. */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = ids.find(id => visible.has(id))
        if (first) setActive(first)
      },
      // The band from 20% to 30% of the viewport height, just under the navbar.
      {rootMargin: '-20% 0px -70% 0px'}
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => {
      observer.disconnect()
    }
  }, [ids])

  return active !== undefined && ids.includes(active) ? active : ids[0]
}
```

- [ ] **Step 4: Run the hook test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/hooks/use-active-section.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing contents test**

```tsx
// apps/web/src/features/rules/components/rules-toc.test.tsx
import type {RuleSection} from '@/features/rules/types'
import {fireEvent, render, screen} from '@testing-library/react'

import {RulesToc} from './rules-toc'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))

const section = (n: number, title: string, items: number): RuleSection => ({
  id: title,
  number: n,
  anchor: `s-${n}`,
  title: {value: title, lang: 'en'},
  items: Array.from({length: items}, (_, i) => ({
    id: `${title}-${i}`,
    number: `${n}.${i + 1}`,
    anchor: `r-${n}-${i + 1}`,
    text: {value: 'x', lang: 'en' as const}
  }))
})

const sections = [section(1, 'General', 4), section(2, 'Chat', 3)]

describe('RulesToc', () => {
  it('links every section with its number and item count', () => {
    render(<RulesToc sections={sections} active="s-1" />)
    const link = screen.getByRole('link', {name: /Chat/})
    expect(link).toHaveAttribute('href', '#s-2')
    expect(link).toHaveTextContent('2')
    expect(link).toHaveTextContent('3')
  })

  it('marks the active section', () => {
    render(<RulesToc sections={sections} active="s-2" />)
    expect(screen.getByRole('link', {name: /Chat/})).toHaveAttribute('aria-current', 'location')
    expect(screen.getByRole('link', {name: /General/})).not.toHaveAttribute('aria-current')
  })

  it('reports navigation so a popover can close', () => {
    const onNavigate = jest.fn()
    render(<RulesToc sections={sections} active="s-1" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('link', {name: /Chat/}))
    expect(onNavigate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Implement `RulesToc`**

```tsx
// apps/web/src/features/rules/components/rules-toc.tsx
'use client'

import type {RuleSection} from '@/features/rules/types'
import {useLocale, useTranslations} from 'next-intl'

export function RulesToc({
  sections,
  active,
  onNavigate
}: {
  sections: RuleSection[]
  active: string | undefined
  onNavigate?: () => void
}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  return (
    <nav aria-label={t('contents')}>
      <p className="eyebrow">{t('contents')}</p>
      <ol className="border-border mt-4 flex flex-col border-l">
        {sections.map(section => (
          <li key={section.id}>
            <a
              href={`#${section.anchor}`}
              aria-current={section.anchor === active ? 'location' : undefined}
              onClick={onNavigate}
              className="text-fg/70 hover:text-fg aria-[current=location]:border-accent aria-[current=location]:text-fg -ml-px flex items-center gap-3 border-l-2 border-transparent py-2.5 pr-2 pl-4 transition-colors">
              <span className="tabular text-accent w-5 shrink-0 text-sm">{section.number}</span>
              <span
                lang={section.title.lang === locale ? undefined : section.title.lang}
                className="min-w-0 flex-1 break-words">
                {section.title.value}
              </span>
              <span className="tabular text-muted shrink-0 text-xs">{section.items.length}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

- [ ] **Step 7: Write the failing search test**

```tsx
// apps/web/src/features/rules/components/rules-search.test.tsx
import {fireEvent, render, screen} from '@testing-library/react'

import {RulesSearch} from './rules-search'

jest.mock('next-intl', () => ({useTranslations: () => (key: string) => key}))

const box = () => screen.getByRole('searchbox', {name: 'searchLabel'})

describe('RulesSearch', () => {
  it('focuses on "/"', () => {
    render(<RulesSearch query="" onQueryChange={jest.fn()} />)
    fireEvent.keyDown(document.body, {key: '/'})
    expect(box()).toHaveFocus()
  })

  it('leaves "/" alone while typing in another field', () => {
    render(
      <>
        <input aria-label="other" />
        <RulesSearch query="" onQueryChange={jest.fn()} />
      </>
    )
    const other = screen.getByRole('textbox', {name: 'other'})
    other.focus()
    fireEvent.keyDown(other, {key: '/'})
    expect(other).toHaveFocus()
  })

  it.each([{ctrlKey: true}, {metaKey: true}, {altKey: true}])(
    'leaves "/" with a modifier to the browser (%o)',
    modifier => {
      render(<RulesSearch query="" onQueryChange={jest.fn()} />)
      fireEvent.keyDown(document.body, {key: '/', ...modifier})
      expect(box()).not.toHaveFocus()
    }
  )

  it('reports typing', () => {
    const onQueryChange = jest.fn()
    render(<RulesSearch query="" onQueryChange={onQueryChange} />)
    fireEvent.change(box(), {target: {value: 'chat'}})
    expect(onQueryChange).toHaveBeenCalledWith('chat')
  })

  it('clears and refocuses', () => {
    const onQueryChange = jest.fn()
    render(<RulesSearch query="chat" onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', {name: 'clearSearch'}))
    expect(onQueryChange).toHaveBeenCalledWith('')
    expect(box()).toHaveFocus()
  })
})
```

- [ ] **Step 8: Implement `RulesSearch`**

```tsx
// apps/web/src/features/rules/components/rules-search.tsx
'use client'

import {Search, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef} from 'react'

const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

export function RulesSearch({
  query,
  onQueryChange
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  const t = useTranslations('rules')
  const input = useRef<HTMLInputElement>(null)

  // "/" jumps to search, unless the reader is typing elsewhere or using a modified shortcut.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div role="search" className="relative">
      <Search
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
      />
      <input
        ref={input}
        type="search"
        value={query}
        onChange={event => {
          onQueryChange(event.target.value)
        }}
        aria-label={t('searchLabel')}
        aria-keyshortcuts="/"
        placeholder={t('searchPlaceholder')}
        className="border-border bg-surface/60 text-fg placeholder:text-muted h-14 w-full rounded-2xl border pr-12 pl-11 focus:border-white/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          aria-label={t('clearSearch')}
          onClick={() => {
            onQueryChange('')
            input.current?.focus()
          }}
          className="text-muted hover:text-fg absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full">
          <X className="size-4" />
        </button>
      ) : (
        <kbd
          title={t('searchShortcut')}
          className="border-border text-muted absolute top-1/2 right-4 -translate-y-1/2 rounded-md border px-1.5 font-mono text-xs">
          /
        </kbd>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Run the three tests**

Run: `pnpm --filter @shop/web exec jest src/features/rules/hooks src/features/rules/components/rules-toc.test.tsx src/features/rules/components/rules-search.test.tsx`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): rules contents with scroll highlight and slash-to-search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `RulesView` composition

**Files:**

- Create: `apps/web/src/features/rules/components/rules-view.tsx`
- Test: `apps/web/src/features/rules/components/rules-view.test.tsx`

**Interfaces:**

- Consumes: `filterRules` (Task 3), `RulesSection` (Task 7), `useActiveSection`, `RulesToc`, `RulesSearch` (Task 8), `MorphPopover` (`@/components/morph-popover`: props `triggerLabel`, `panelLabel`, `closeLabel`, `trigger`, `panelClassName`, `children: (close) => ReactNode`).
- Produces: `RulesView({sections, rulesPath}: {sections: RuleSection[]; rulesPath: string})`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/rules/components/rules-view.test.tsx
import type {RuleSection} from '@/features/rules/types'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {RulesView} from './rules-view'

jest.mock('next-intl', () => ({
  useLocale: () => 'pl',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(',')}` : key
}))

const pl = (value: string) => ({value, lang: 'pl' as const})

const sections: RuleSection[] = [
  {
    id: 'chat',
    number: 1,
    anchor: 's-1',
    title: pl('Czat'),
    items: [{id: 'c1', number: '1.1', anchor: 'r-1-1', text: pl('Zakaz spamu.')}]
  },
  {
    id: 'cheats',
    number: 2,
    anchor: 's-2',
    title: pl('Sprawdzanie'),
    items: [{id: 'x1', number: '2.1', anchor: 'r-2-1', text: pl('**Złośliwe** oprogramowanie.')}]
  }
]

const setup = () => render(<RulesView sections={sections} rulesPath="/pl/rules" />)
const search = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', {name: 'searchLabel'}), {target: {value}})
}

describe('RulesView', () => {
  it('shows every section', () => {
    setup()
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })

  it('filters by query and highlights', () => {
    const {container} = setup()
    search('zlosliwe')
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1)
    expect(container.querySelector('mark')).toHaveTextContent('Złośliwe')
  })

  it('shows an empty state that clears the search', () => {
    setup()
    search('nic takiego')
    expect(screen.getByText('noResults nic takiego')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', {name: 'clearSearch'}).at(-1) as HTMLElement)
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })

  it('clears the search when a rule link changes the hash', () => {
    setup()
    search('zlosliwe')
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rules-view.test.tsx`
Expected: FAIL, "Cannot find module './rules-view'".

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/features/rules/components/rules-view.tsx
'use client'

import {MorphPopover} from '@/components/morph-popover'
import {RulesSearch} from '@/features/rules/components/rules-search'
import {RulesSection} from '@/features/rules/components/rules-section'
import {RulesToc} from '@/features/rules/components/rules-toc'
import {useActiveSection} from '@/features/rules/hooks/use-active-section'
import {filterRules} from '@/features/rules/lib/filter-rules'
import type {RuleSection} from '@/features/rules/types'
import {List} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

export function RulesView({sections, rulesPath}: {sections: RuleSection[]; rulesPath: string}) {
  const t = useTranslations('rules')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const visible = filterRules(sections, query, locale)
  const active = useActiveSection(visible.map(section => section.anchor))

  // A rule link (#r-2-3) must not land on an item the search has hidden: clear it, then scroll
  // again because the list above the target just grew.
  useEffect(() => {
    const onHash = () => {
      setQuery('')
      requestAnimationFrame(() => {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
      <aside className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
        <RulesSearch query={query} onQueryChange={setQuery} />
        <div className="hidden lg:block">
          <RulesToc sections={visible} active={active} />
        </div>
        <div className="flex justify-end lg:hidden">
          <MorphPopover
            triggerLabel={t('openContents')}
            panelLabel={t('contents')}
            closeLabel={t('closeContents')}
            triggerClassName="h-11 border border-border px-4 text-sm font-medium hover:border-white/25"
            panelClassName="w-[min(20rem,calc(100vw-2*var(--gutter)))] p-4"
            trigger={
              <>
                <List aria-hidden className="text-muted size-4" />
                <span>{t('contents')}</span>
              </>
            }>
            {close => <RulesToc sections={visible} active={active} onNavigate={close} />}
          </MorphPopover>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {visible.length === 0 ? (
          <div role="status" className="border-border rounded-2xl border p-10 text-center">
            <p className="text-fg/85">{t('noResults', {query: query.trim()})}</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
              }}
              className="border-border mt-4 rounded-full border px-5 py-2 text-sm hover:border-white/30">
              {t('clearSearch')}
            </button>
          </div>
        ) : (
          visible.map(section => (
            <RulesSection
              key={section.id}
              section={section}
              query={query}
              locale={locale}
              rulesPath={rulesPath}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @shop/web exec jest src/features/rules/components/rules-view.test.tsx`
Expected: PASS. If `MorphPopover` fails to render in jsdom, copy the `motion/react` mock from `src/features/settings/components/settings-menu.test.tsx` into this test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/rules
git commit -m "feat(web): rules view with filtering, contents popover and empty state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `/rules` route, header, metadata, e2e

**Files:**

- Create: `apps/web/src/app/[locale]/rules/page.tsx`
- Create: `e2e/tests/rules.spec.ts`

**Interfaces:**

- Consumes: `getRules` (Task 4), `numberRules` (Task 1), `RulesView` (Task 9), `Footer` from `@/app/[locale]/_components/footer`, `getPathname` from `@/i18n/navigation`, `routing` / `Locale` from `@/i18n/routing`.
- Produces: routes `/rules` (EN) and `/pl/rules` (PL).

`/rules` is a static segment, so it wins over the dynamic `[server]` segment. The navbar already links `PAGES.rules`. The layout's skip link targets `#shop`, so `<main>` gets `id="shop"` like the home page target.

- [ ] **Step 1: Write the e2e spec (fails until the page exists)**

```ts
// e2e/tests/rules.spec.ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

test('a PL rule link scrolls to and flashes the rule', async ({page}) => {
  await page.goto(`${WEB}/pl/rules#r-2-3`)
  const rule = page.locator('#r-2-3')
  await expect(rule).toBeInViewport()
  await expect(rule).toHaveCSS('animation-name', 'rule-flash')
})

test('PL search ignores diacritics and highlights the original word', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await page.getByRole('searchbox', {name: 'Szukaj w zasadach'}).fill('zlosliwe')
  await expect(page.locator('mark', {hasText: 'Złośliwe'})).toBeVisible()
  await expect(page.locator('#r-1-1')).toHaveCount(0)
})

test('"/" focuses the search', async ({page}) => {
  await page.goto(`${WEB}/rules`)
  await page.keyboard.press('/')
  await expect(page.getByRole('searchbox', {name: 'Search the rules'})).toBeFocused()
})

test('section counts use Polish plural forms', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByText('4 punkty').first()).toBeVisible()
  await expect(page.getByText('5 punktów')).toBeVisible()
})

test('edition date is localized', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByText('Obowiązująca wersja z 28 maja 2026')).toBeVisible()
  await page.goto(`${WEB}/rules`)
  await expect(page.getByText('Current edition: May 28, 2026')).toBeVisible()
})

test.describe('copy link', () => {
  test.skip(
    ({browserName}) => browserName !== 'chromium',
    'clipboard permissions are Chromium-only'
  )
  test.use({permissions: ['clipboard-read', 'clipboard-write']})

  for (const [path, label] of [
    ['/pl/rules', 'Kopiuj link do zasady 2.3'],
    ['/rules', 'Copy link to rule 2.3']
  ] as const) {
    test(`on ${path} copies a link in that language`, async ({page}) => {
      await page.goto(`${WEB}${path}`)
      await page.locator('#r-2-3').hover()
      await page.getByRole('button', {name: label}).click()
      await expect(page.locator('#r-2-3').getByRole('status')).not.toBeEmpty()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${WEB}${path}#r-2-3`)
    })
  }
})

test.describe('phone', () => {
  test.use({viewport: {width: 375, height: 800}})

  test('no horizontal scroll and contents open from a popover', async ({page}) => {
    await page.goto(`${WEB}/pl/rules`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', {name: 'Pokaż spis treści'}).click()
    await page
      .getByRole('dialog')
      .getByRole('link', {name: /Rozgrywka/})
      .click()
    await expect(page).toHaveURL(/\/pl\/rules#s-4$/)
  })
})
```

The panel role: check `MorphPopover`'s panel (`role="dialog"` with `aria-label={panelLabel}`, as used in `e2e/tests/morph-popover.spec.ts`). If it differs, adjust the locator, not the component.

- [ ] **Step 2: Implement the page**

```tsx
// apps/web/src/app/[locale]/rules/page.tsx
import {Footer} from '@/app/[locale]/_components/footer'
import {getRules} from '@/features/rules/api/get-rules'
import {RulesView} from '@/features/rules/components/rules-view'
import {numberRules} from '@/features/rules/lib/number-rules'
import {getPathname} from '@/i18n/navigation'
import {type Locale, routing} from '@/i18n/routing'
import {CalendarDays} from 'lucide-react'
import type {Metadata} from 'next'
import {hasLocale} from 'next-intl'
import {getFormatter, getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'

// EN has no prefix (`localePrefix: 'as-needed'`): /rules and /pl/rules.
const rulesPath = (locale: Locale) => getPathname({href: '/rules', locale})

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({locale, namespace: 'rules'})
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: rulesPath(locale),
      languages: {
        ...Object.fromEntries(routing.locales.map(l => [l, rulesPath(l)])),
        'x-default': rulesPath(routing.defaultLocale)
      }
    }
  }
}

export default async function RulesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const [rules, t, format] = await Promise.all([
    getRules(locale),
    getTranslations({locale, namespace: 'rules'}),
    getFormatter({locale})
  ])

  return (
    <>
      <main id="shop" className="max-w-page mx-auto px-[var(--gutter)] pt-36 pb-24">
        <header className="max-w-3xl">
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-none font-bold tracking-tight uppercase">
            {t.rich('title', {accent: chunks => <span className="text-accent">{chunks}</span>})}
          </h1>
          <p className="text-muted mt-6 text-lg">{t('lead')}</p>
          {rules && (
            <p className="border-border text-muted mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
              <CalendarDays aria-hidden className="text-accent size-4" />
              {t('edition', {
                // UTC: the edition is a calendar date, it must not move with the server's time zone.
                date: format.dateTime(new Date(rules.publishedAt), {
                  dateStyle: 'long',
                  timeZone: 'UTC'
                })
              })}
            </p>
          )}
        </header>
        <div className="mt-14">
          {rules ? (
            <RulesView sections={numberRules(rules)} rulesPath={rulesPath(locale)} />
          ) : (
            <p role="status" className="text-muted">
              {t('unavailable')}
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Run the unit suite, types and lint**

Run (repo root): `pnpm typecheck && pnpm lint && pnpm --filter @shop/web test`
Expected: all PASS. If `getPathname` rejects the object form, check its signature in `node_modules/next-intl` (`getPathname({href, locale})` in next-intl 4) or Context7 before changing it.

- [ ] **Step 4: Run the e2e spec**

Run (repo root):

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait
pnpm --filter @shop/e2e exec playwright test tests/rules.spec.ts
```

Expected: PASS on chromium; on webkit the copy tests are skipped.

- [ ] **Step 5: Look at it**

Open `http://shop.localhost/pl/rules` at desktop and 375 px width; compare with `rules.png` (layout: header, left search + contents, right section cards). Fix spacing only if something is visibly broken; visual polish is the parallel design track.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app e2e/tests/rules.spec.ts
git commit -m "feat(web): /rules page in EN and PL with localized metadata

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Language switch keeps the rule anchor

**Files:**

- Modify: `apps/web/src/features/settings/components/settings-menu.tsx` (the `router.replace` call in `SettingsOptions`)
- Test: `apps/web/src/features/settings/components/settings-menu.test.tsx`, `e2e/tests/rules.spec.ts`

**Interfaces:**

- Consumes: `SettingsOptions` (used by `SettingsMenu` and `mobile-menu.tsx`, so both get the fix).

- [ ] **Step 1: Write the failing unit test** (add to `describe('SettingsMenu', …)`)

```tsx
it('keeps the hash when switching the locale', () => {
  window.location.hash = '#r-2-3'
  setup()
  open()
  fireEvent.click(screen.getByRole('radio', {name: /Polski/}))
  expect(mockReplace).toHaveBeenCalledWith('/cases#r-2-3', {locale: 'pl', scroll: false})
  window.location.hash = ''
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/settings/components/settings-menu.test.tsx`
Expected: FAIL, received `'/cases'`.

- [ ] **Step 3: Implement**

In `SettingsOptions`, replace

```tsx
router.replace(pathname, {locale: code, scroll: false})
```

with

```tsx
// Keep the anchor: /rules#r-2-3 in EN is the same rule as /pl/rules#r-2-3.
router.replace(`${pathname}${window.location.hash}`, {locale: code, scroll: false})
```

- [ ] **Step 4: Run the unit test**

Run: `pnpm --filter @shop/web exec jest src/features/settings/components/settings-menu.test.tsx`
Expected: PASS, including the existing `'/cases'` case (empty hash).

- [ ] **Step 5: Add the e2e check** to `e2e/tests/rules.spec.ts`

```ts
test('switching language keeps the rule anchor', async ({page}) => {
  await page.goto(`${WEB}/rules#r-2-3`)
  await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')
  await page.getByRole('button', {name: 'Language and currency'}).click()
  await page.getByRole('radio', {name: /Polski/}).click()
  await expect(page).toHaveURL(/\/pl\/rules#r-2-3$/)
})
```

Run: `pnpm --filter @shop/e2e exec playwright test tests/rules.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/settings e2e/tests/rules.spec.ts
git commit -m "fix(web): keep the URL hash when switching language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `getSiteSettings()` and its consumers

**Files:**

- Modify: `apps/web/src/config/site.ts`
- Create: `apps/web/src/features/site-settings/api/get-site-settings.ts`
- Test: `apps/web/src/features/site-settings/api/get-site-settings.test.ts`
- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/_components/navbar.tsx`, `apps/web/src/app/[locale]/_components/footer.tsx`, `apps/web/src/app/[locale]/_components/hero.tsx`, `apps/web/src/app/[locale]/_components/home-view.tsx`, `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/[locale]/[server]/page.tsx`, `apps/web/src/app/[locale]/rules/page.tsx`

**Interfaces:**

- Produces:
  - `type SiteSettings = {siteName: {plain: string; accent: string}; serverIp: string; discordUrl: string; supportEmail: string}` (from `@/config/site`)
  - `DEFAULT_SITE_SETTINGS: SiteSettings`
  - `getSiteSettings(): Promise<SiteSettings>`
  - `Navbar({siteName})`, `Footer({settings})`, `Hero({serverIp})`, `HomeView({server, settings})`
- Removes: `SITE_NAME`, `SERVER_IP`, `DISCORD_URL` exports. The compiler then points at every leftover consumer.

Settings flow as props from Server Components (pages, layout) because `Hero` and `Footer` are synchronous Server Components using `useTranslations`, and `Navbar` is a Client Component.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/site-settings/api/get-site-settings.test.ts
import {DEFAULT_SITE_SETTINGS} from '@/config/site'

import {getSiteSettings} from './get-site-settings'

describe('getSiteSettings', () => {
  it('returns the defaults until the content API exists', async () => {
    await expect(getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS)
  })

  it('keeps the current brand values', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({
      siteName: {plain: 'Block', accent: 'haus'},
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example'
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @shop/web exec jest src/features/site-settings`
Expected: FAIL, "Cannot find module './get-site-settings'".

- [ ] **Step 3: Replace the brand constants in `config/site.ts`**

Replace the `SITE_NAME`, `SERVER_IP` and `DISCORD_URL` lines with:

```ts
/** Brand values an admin will edit (spec §6.4). Phase 2 loads them from the API; these are the fallback. */
export type SiteSettings = {
  /** The wordmark is set in two parts: the second one in the accent colour. */
  siteName: {plain: string; accent: string}
  serverIp: string
  discordUrl: string
  supportEmail: string
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: {plain: 'Block', accent: 'haus'},
  serverIp: 'mc.mineblaze.net',
  discordUrl: 'https://discord.com',
  supportEmail: 'support@blockhaus.example'
}
```

Keep `PAGES`, `LEGAL_DOCS`, `legalPath` unchanged. Update the file's first comment to: `// Brand defaults, links and contacts. Change them here, not in the components.`

- [ ] **Step 4: Add the read function**

```ts
// apps/web/src/features/site-settings/api/get-site-settings.ts
import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@/config/site'

/**
 * Brand settings. Phase 1 returns the defaults; phase 2 fetches `/api/content/settings` behind
 * `'use cache'` and falls back to `DEFAULT_SITE_SETTINGS` (spec §6.2), keeping this signature.
 */
export function getSiteSettings(): Promise<SiteSettings> {
  return Promise.resolve(DEFAULT_SITE_SETTINGS)
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @shop/web exec jest src/features/site-settings`
Expected: PASS.

- [ ] **Step 6: Switch the consumers**

1. `navbar.tsx`: import `type SiteSettings` from `@/config/site` (keep `PAGES`), change the signature to `export function Navbar({siteName}: {siteName: SiteSettings['siteName']})`, and render `{siteName.plain}` / `{siteName.accent}` instead of `SITE_NAME.*`.
2. `layout.tsx`: `import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'`; in `LocaleLayout` add `const settings = await getSiteSettings()` next to `getMessages()` and render `<Navbar siteName={settings.siteName} />`.
3. `footer.tsx`: change the import to `import {LEGAL_DOCS, PAGES, type SiteSettings, legalPath} from '@/config/site'`; signature `export function Footer({settings}: {settings: SiteSettings})`; replace `DISCORD_URL` → `settings.discordUrl`, `SITE_NAME.plain/accent` → `settings.siteName.plain/accent`, `SERVER_IP` → `settings.serverIp`.
4. `hero.tsx`: remove the `SERVER_IP` import; signature `export function Hero({serverIp}: {serverIp: string})`; `<CopyIp ip={serverIp} />`.
5. `home-view.tsx`: signature `export function HomeView({server, settings}: {server: string; settings: SiteSettings})` (import `type SiteSettings` from `@/config/site`); render `<Hero serverIp={settings.serverIp} />` and `<Footer settings={settings} />`.
6. `app/[locale]/page.tsx`:

```tsx
import {HomeView} from '@/app/[locale]/_components/home-view'
import {defaultServer} from '@/config/servers'
import {getSiteSettings} from '@/features/site-settings/api/get-site-settings'

export default async function HomePage() {
  return <HomeView server={defaultServer.slug} settings={await getSiteSettings()} />
}
```

7. `app/[locale]/[server]/page.tsx`: import `getSiteSettings`; return `<HomeView server={server} settings={await getSiteSettings()} />`.
8. `app/[locale]/rules/page.tsx`: add `getSiteSettings()` to the `Promise.all` (`const [rules, t, format, settings] = …`) and render `<Footer settings={settings} />`.

- [ ] **Step 7: Verify nothing still uses the removed constants**

Run: `grep -rn "SITE_NAME\|SERVER_IP\|DISCORD_URL" apps/web/src`
Expected: no output.

Run (repo root): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: all PASS.

- [ ] **Step 8: Check the pages still show the brand**

Run: `pnpm --filter @shop/e2e exec playwright test tests/smoke.spec.ts tests/rules.spec.ts`
Expected: PASS. Open `http://shop.localhost/` and confirm the navbar wordmark, hero IP button and footer show `Blockhaus` / `mc.mineblaze.net`.

- [ ] **Step 9: Commit and refresh the graph**

```bash
git add apps/web/src
git commit -m "refactor(web): read brand values through getSiteSettings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
graphify update .
```

---

## Done when

- `/rules` and `/pl/rules` render the demo rules with contents, search, anchors, copy text/link, localized counts and date.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` pass; `e2e/tests/rules.spec.ts` passes on chromium (webkit skips clipboard tests).
- No component imports `SITE_NAME`, `SERVER_IP` or `DISCORD_URL`; `getRules` and `getSiteSettings` are the only data entry points phase 2 has to change.
