# Admin polish B — Rich text (bold / italic / underline) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rule texts and product descriptions get bold, italic and underline through a Notion-like selection toolbar in the admin, stored as the existing mini-markdown (extended) and rendered on the site.

**Architecture:** `@shop/shared/rules` gets a nesting parser that returns a node tree, a serializer, and one new mark (`++underline++`) plus backslash escapes. Web and admin render the tree. The admin edits with a Tiptap field (`RichTextField`) that converts mini-markdown ⇄ ProseMirror JSON through the shared tree. A migration escapes stray markup characters in existing product descriptions so they keep rendering literally.

**Tech Stack:** valibot, Tiptap v3 (`@tiptap/react`, `@tiptap/react/menus` `BubbleMenu`, `@tiptap/pm`, `@tiptap/extension-document|paragraph|text|bold|italic|underline|link|hard-break`, `@tiptap/extensions` for `UndoRedo`/`Placeholder`), Motion, Prisma, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-polish-design.md` (part 7). Builds on plan A (`Hint`, `RollingIndicator`, motion tokens in `globals.css`).

## Global Constraints

- Marks: **bold**, _italic_, underline. Links only where they already exist (rules). No colours, headings or lists.
- Fields: rule section titles and rule items (EN, PL), product `description` (EN, PL). Product `sections`, names, Content → Texts and brand settings stay plain.
- Marks may combine (bold + italic, underline inside a link). Old texts stay valid; rules need no data migration.
- Syntax (decided): `**bold**`, `*italic*`, `++underline++`, `[label](href)`; `\` escapes any of `\ * + [ ] ( )`.
- Descriptions do not render links (`[a](b)` shows literally); only rules do.
- Descriptions are multi-line: a line break is `\n` and renders as a line break. Rule titles are single-line (Enter does nothing).
- Toolbar motion follows `DESIGN.md` Motion (ease-out, no bounce, no reduced-motion opt-out).
- Gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm test:int`); `graphify update .` after code edits; Conventional Commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Unclosed or mismatched delimiters (`**bold`, `*a**`, `++x`) must render as literal text, never swallow the rest of the string.
2. A round trip `toMarkdown(parseRich(s))` must not change what a reader sees for any existing rule text in `apps/api/src/seed/` and the e2e fixtures.
3. Literal `*`, `+`, `[` typed in the editor must survive a save (serializer escapes them) and render literally.
4. Unsafe links (`javascript:`, `//evil`) typed or pasted into the rules editor are still refused by validation and render as text.
5. Pasting rich HTML from another site into the editor must keep only bold/italic/underline (and links in rules), never other markup.

---

### Task 1: Nesting mini-markdown in `@shop/shared/rules`

**Files:**

- Modify: `packages/shared/src/rules.ts`, `packages/shared/src/rules.spec.ts`

**Interfaces:**

- Produces:
  - `type RichNode = {type: 'text'; value: string} | {type: 'strong' | 'em' | 'u'; children: RichNode[]} | {type: 'link'; href: string; children: RichNode[]}`
  - `parseRich(source: string, opts?: {links?: boolean}): RichNode[]` — `links` defaults to `true`; with `false`, `[x](y)` stays literal text. An unsafe href renders its label as plain (formatted) children, as today.
  - `toPlainText(nodes: RichNode[]): string` — the words a reader sees (escapes removed).
  - `toMarkdown(nodes: RichNode[]): string` — inverse; escapes `\ * + [ ] ( )` inside text values.
  - `hasOnlySafeLinks` unchanged in behaviour (ignores escaped `\[`).
  - Remove `parseInline` and `Inline` once Tasks 2–3 have moved callers (do it in Task 3's commit).
- The `v.description` of `RuleText` mentions `++underline++`.

- [ ] **Step 1: Failing tests** in `rules.spec.ts` (`describe('parseRich')`):
  - `'a **b** *c* ++d++'` → `[text 'a ', strong[b], text ' ', em[c], text ' ', u[d]]`
  - nesting: `'**bold *both***'` → `strong[text 'bold ', em[both]]`; `'++[x](/faq)++'` → `u[link /faq [x]]`; `'[**x**](/a)'` → `link[strong[x]]`
  - unclosed: `'**bold'` → `[text '**bold']`; `'a ++b'` → `[text 'a ++b']`; `'*a**'` → literal text
  - escapes: `'\\*not\\* \\[x\\](/y)'` → `[text '*not* [x](/y)']`
  - `links: false`: `'[x](/a)'` → `[text '[x](/a)']`
  - unsafe: `'[x](javascript:alert(1))'` → `[text 'x']`
  - `toPlainText(parseRich('**a** \\*b'))` → `'a *b'`
  - round trip: for each of `['plain', '**a** *b* ++c++', '**x *y***', '[l](/p)', 'lit \\* \\+ \\[']`, `toMarkdown(parseRich(s))` re-parses to the same tree.
- [ ] **Step 2: Run** `pnpm --filter @shop/shared test -- rules` — FAIL (`parseRich` not exported).
- [ ] **Step 3: Implement** a single-pass recursive descent: at each position try, in order, escape, `**`, `++`, `*`, `[label](href)`; an opener is used only if its closer exists later at the same depth (scan with escapes honoured), else the opener is literal text. Merge adjacent text nodes.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(shared): nesting mini-markdown with underline and escapes`

### Task 2: Web renders the tree (rules and product descriptions)

**Files:**

- Modify: `apps/web/src/features/rules/components/rich-text.tsx` (+ test), `rule-row.tsx`, `apps/web/src/features/rules/lib/filter-rules.ts`
- Modify: `apps/web/src/features/catalog/components/product-detail.tsx:96-98`
- Test: `rich-text.test.tsx`, `product-detail` test if present (else add a case to the nearest catalog component test)

**Interfaces:**

- Consumes: `parseRich`, `toPlainText` (Task 1).
- Produces: `RichText({text, mark, links}: {text: string; mark?: (v: string) => ReactNode; links?: boolean})` — renders `strong` (`font-semibold text-fg`), `em`, `u` (`underline underline-offset-2`), links as today; `mark` wraps every text leaf (search highlighting keeps working inside nested marks).

- [ ] **Step 1: Failing tests** — `renders underline`; `renders bold inside italic`; `highlights a match inside nested marks` (mark wraps leaf); product detail: description `'**Fast** delivery\nall day'` renders a `<strong>` and a line break (container has `whitespace-pre-line`), and `'[x](/a)'` renders literally (no link).
- [ ] **Step 2: Run** `pnpm --filter @shop/web test -- rich-text product-detail` — FAIL.
- [ ] **Step 3: Implement**; description uses `<RichText text={product.description} links={false} />` inside `<p className="leading-relaxed whitespace-pre-line text-fg/85">`.
- [ ] **Step 4: Run** web tests — PASS.
- [ ] **Step 5: Commit** `feat(web): render underline and nested marks; formatted product descriptions`

### Task 3: Admin preview renders the tree; drop `parseInline`

**Files:**

- Modify: `apps/admin/src/features/content/components/rules-preview.tsx` (+ test)
- Modify: `packages/shared/src/rules.ts` (remove `parseInline`/`Inline`)

- [ ] **Step 1: Failing test** — `rules preview renders ++underline++ and nested marks` (`container.querySelector('u')`, `strong em`).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** a recursive renderer over `parseRich`; delete `parseInline`; `pnpm typecheck` must show no remaining callers.
- [ ] **Step 4: Run** admin + web + shared tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): preview renders underline and nested marks`

### Task 4: Escape stray markup in existing product descriptions

**Files:**

- Create: `apps/api/prisma/migrations/20261020100000_escape_product_descriptions/migration.sql`
- Test: `apps/api/test/catalog-products.int-spec.ts` (new case) or a new `rich-text-migration.int-spec.ts`

- [ ] **Step 1: Failing int test** — insert a translation with description `'2*3 [a](b) + \\ done'` via Prisma, run the migration SQL file's statement (read it from disk and `$executeRawUnsafe`), expect `'2\\*3 \\[a\\]\\(b\\) \\+ \\\\ done'`, and `toPlainText(parseRich(desc, {links: false}))` equals the original.
- [ ] **Step 2: Run** `pnpm --filter @shop/api test:int -- rich-text-migration` — FAIL (file missing).
- [ ] **Step 3: Implement** `UPDATE "product_translations" SET "description" = regexp_replace("description", '([\\*+\[\]()])', '\\\1', 'g') WHERE "description" ~ '[\\*+\[\]()]';` (verify the escaping in the test, not by eye). Check `apps/api/src/seed/seed-catalog.ts` descriptions contain none of these characters, or escape them there too.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `fix(api): escape markup characters in existing product descriptions`

### Task 5: `RichTextField` — Tiptap field with an animated selection toolbar

**Files:**

- Create: `apps/admin/src/components/rich-text/markdown-doc.ts` (+ `markdown-doc.test.ts`), `apps/admin/src/components/rich-text/rich-text-field.tsx` (+ test)
- Modify: `apps/admin/package.json` (Tiptap deps; check current versions with Context7 `/websites/tiptap_dev`), `apps/admin/src/app/globals.css` (toolbar keyframes)

**Interfaces:**

- Consumes: `parseRich`, `toMarkdown`, `RichNode` (Task 1).
- Produces:
  - `toDoc(markdown: string, opts: {multiline: boolean; links: boolean}): JSONContent` — one paragraph; `\n` becomes `hardBreak` when multiline.
  - `fromDoc(doc: JSONContent): string` — marks `bold|italic|underline|link` → `strong|em|u|link` nodes → `toMarkdown`; `hardBreak` → `\n`; multiple paragraphs (paste) join with `\n`.
  - `RichTextField({id, value, onChange, multiline = false, links = false, placeholder, 'aria-invalid', 'aria-describedby', 'aria-labelledby'}: {...; value: string; onChange: (markdown: string) => void})` — `useEditor({immediatelyRender: false, extensions: [Document, Paragraph, Text, Bold, Italic, Underline, UndoRedo, Placeholder, ...(multiline ? [HardBreak] : []), ...(links ? [Link.configure({openOnClick: false, autolink: false, protocols: ['https']})] : [])]})`; `editorProps.attributes`: `id`, `role: 'textbox'`, `aria-multiline`, aria props, classes matching `Input`/`Textarea` (`rounded-plate border border-border bg-surface px-3 py-2 text-sm`, `min-h-16` when multiline, `ring-accent` focus). Single-line: Enter is swallowed (`handleKeyDown`). External `value` changes (form reset, tab switch) call `editor.commands.setContent(toDoc(value))` only when `fromDoc(editor.getJSON()) !== value`.
  - Toolbar: `BubbleMenu` with three `aria-pressed` buttons named "Bold", "Italic", "Underline" (icons `Bold`, `Italic`, `Underline` from lucide), each wrapped in `Hint` with its shortcut ("Bold ⌘B"); active mark = `RollingIndicator`-style accent-soft pill. Pasted HTML is limited by the schema (only the listed marks exist), which covers Review Focus 5.
  - Toolbar motion (impeccable `animate`): appears with opacity 0→1, `translateY(4px)→0`, `scale(0.96)→1`, 160 ms `cubic-bezier(0.16,1,0.3,1)`, transform-origin at the selection side; hides in 100 ms ease-in; buttons cascade 20 ms; the active pill rolls between B/I/U when the selection's marks change (spring, `bounce: 0`, 0.25 s). Class `rich-toolbar` + keyframes `rich-toolbar-in/out` in `globals.css`.

- [ ] **Step 1: Failing tests**
  - `markdown-doc.test.ts`: `toDoc('**a** ++b++', …)` has text nodes with marks `bold` and `underline`; `fromDoc(toDoc(s))` === `s` for `['plain', '**a** *b* ++c++', '**x *y***', 'line\nnext', 'lit \\* \\+']` (multiline, links false) and for `'[l](/p)'` with links true; `fromDoc` of two pasted paragraphs gives `'a\nb'`.
  - `rich-text-field.test.tsx`: renders `**Hi**` with a `<strong>Hi</strong>` inside `role=textbox`; the textbox is named by `aria-labelledby`; changing `value` from outside updates the content; `Mod-b` on a selected word calls `onChange` with `**…**` (select via `editor.commands.setTextSelection` exposed through a test-only `onReady?: (editor) => void` prop — keep it, it costs nothing at runtime).
- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- markdown-doc rich-text-field` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): rich text field with an animated selection toolbar`

### Task 6: Use `RichTextField` in the rules editor and the product editor

**Files:**

- Modify: `apps/admin/src/features/content/components/rules-editor.tsx` (`TextField`: `Controller` + `RichTextField`, `multiline` for items, `links` always true), its test
- Modify: `apps/admin/src/features/catalog/components/product-editor.tsx` (`translations.{en,pl}.description`: `Controller` + `RichTextField multiline`), its test
- Modify: `DESIGN.md` (Components: `RichTextField`; rule: formatted fields use it, plain fields keep `Input`)

**Interfaces:**

- Consumes: `RichTextField` (Task 5). `Label htmlFor` no longer targets a form control: give each label an `id` and pass `aria-labelledby`; tests that used `getByLabelText` keep working because `aria-labelledby` names the textbox.

- [ ] **Step 1: Failing tests** — rules editor: `Rule 1.1 (EN)` is a `textbox` with the existing text; typing plain text still saves the same body as before (existing save test passes unchanged); the PL-fallback hint is still the accessible description. Product editor: `Description (EN)` is a multiline textbox and saving sends `translations.en.description` as markdown.
- [ ] **Step 2: Run** — FAIL (still `Input`/`Textarea`).
- [ ] **Step 3: Implement.** Existing tests that `fireEvent.change` the old inputs switch to the field's `onReady` editor or `userEvent.type` on the textbox.
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): formatted rules and product descriptions`

### Task 7: E2E and the full gate

**Files:**

- Modify: `e2e/tests/admin.spec.ts` (rules publish test: field is now a textbox — use `fill` on the contenteditable or `pressSequentially`)

- [ ] **Step 1: E2E** — in the rules test, after filling the probe: select the word with a double-click, click the toolbar's `Bold` button, expect `region 'Preview'` to contain `strong` with that word; restore as today. Product: open an existing product, select a word in `Description (EN)`, press `Control+U`/`Meta+U`, save, reload, expect a `u` element in the field.
- [ ] **Step 2: Run** the full gate, then a fresh e2e stack (`docker compose -p shop-e2e -f compose.yaml -f compose.e2e.yaml up -d --build --wait`, run, `down -v`). Expected: green.
- [ ] **Step 3: Commit** `test(e2e): bold in the rules editor, underline in a description`
