import type {RulesDocument} from '@shop/shared/rules'

/** Both languages are always strings in the form; an empty PL text means "use the English one". */
type TextForm = {en: string; pl: string}
export type RuleItemForm = {id: string; text: TextForm}
export type RuleSectionForm = {id: string; title: TextForm; items: RuleItemForm[]}
/** A rule or section added in the editor has the id `''` until `formToDocument` names it. */
export type RulesForm = {sections: RuleSectionForm[]}

/** Shared by the versions list (which restores) and the editor (which takes the restored draft). */
export const RESTORE_RULES_KEY = 'restore-rules-version'

export const emptySection = (): RuleSectionForm => ({id: '', title: {en: '', pl: ''}, items: []})
export const emptyItem = (): RuleItemForm => ({id: '', text: {en: '', pl: ''}})

const textToForm = (t: {en: string; pl?: string}): TextForm => ({en: t.en, pl: t.pl ?? ''})
const textToDocument = (t: TextForm) => (t.pl.trim() === '' ? {en: t.en} : {en: t.en, pl: t.pl})

export const documentToForm = (doc: RulesDocument): RulesForm => ({
  sections: doc.sections.map(s => ({
    id: s.id,
    title: textToForm(s.title),
    items: s.items.map(i => ({id: i.id, text: textToForm(i.text)}))
  }))
})

const MAX_ID = 60

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `base`, or `base-2`, `base-3`… (or `base-<start>`… when given) — the first one not taken. */
function unique(base: string, taken: Set<string>, start?: number) {
  const candidate = (n: number | undefined) => {
    if (n === undefined) return base.slice(0, MAX_ID)
    const suffix = `-${String(n)}`
    return base.slice(0, MAX_ID - suffix.length).replace(/-+$/, '') + suffix
  }
  let n = start
  while (taken.has(candidate(n))) n = n === undefined ? 2 : n + 1
  const id = candidate(n)
  taken.add(id)
  return id
}

/**
 * The document the API stores. New sections get `slug(EN title)`, new rules `<section id>-<n>`
 * (n = the rule's number), each unique among all ids of the document. Existing ids never change:
 * they are what links to a rule point at.
 */
export function formToDocument(form: RulesForm): RulesDocument {
  const taken = new Set(form.sections.flatMap(s => [s.id, ...s.items.map(i => i.id)]))
  taken.delete('')
  const sectionIds = form.sections.map(s => s.id || unique(slug(s.title.en) || 'section', taken))
  return {
    sections: form.sections.map((s, si) => {
      const sectionId = sectionIds[si] ?? ''
      return {
        id: sectionId,
        title: textToDocument(s.title),
        items: s.items.map((item, ii) => ({
          id: item.id || unique(sectionId, taken, ii + 1),
          text: textToDocument(item.text)
        }))
      }
    })
  }
}
