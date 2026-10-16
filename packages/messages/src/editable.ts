/** UI texts an admin may override (site-content spec §8). Adding a key is a code change. */
export const EDITABLE_MESSAGES = [
  'meta.title',
  'meta.description',
  'hero.title',
  'hero.lead',
  'hero.joinUs',
  'hero.newSeason',
  'hero.version',
  'how.*',
  'fair.title',
  'fair.lead',
  'faq.*',
  'footer.demo',
  'rules.title',
  'rules.lead'
] as const

export function isEditableKey(key: string): boolean {
  return EDITABLE_MESSAGES.some(pattern =>
    pattern.endsWith('.*')
      ? key.startsWith(pattern.slice(0, -1)) && key.length > pattern.length - 1
      : key === pattern
  )
}
