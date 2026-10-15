import type {ProductForm} from '@/features/catalog/schemas'

import {
  type AdminProduct,
  type ProductCreate,
  type ProductUpdate,
  fromMinor,
  toMinor
} from '@shop/shared/catalog-admin'

type TranslationForm = ProductForm['translations']['en']

const blank = (): TranslationForm => ({name: '', description: '', sections: []})

export const emptyProductForm = (serverId = '', categoryId = ''): ProductForm => ({
  serverId,
  categoryId,
  slug: '',
  kind: 'PERMANENT',
  durationDays: '',
  mark: '',
  icon: 'crown',
  isActive: false,
  grant: '',
  revoke: '',
  prices: {EUR: '', PLN: ''},
  translations: {en: blank(), pl: blank()}
})

export function productToForm(p: AdminProduct): ProductForm {
  const tr = (t: AdminProduct['translations']['en']): TranslationForm =>
    t
      ? {
          name: t.name,
          description: t.description,
          sections: t.sections.map(s => ({
            title: s.title,
            entries: s.entries.map(e => ({
              cmd: e.cmd ?? '',
              text: e.text ?? '',
              cooldown: e.cooldown ?? ''
            }))
          }))
        }
      : blank()
  return {
    serverId: p.serverId,
    categoryId: p.categoryId,
    slug: p.slug,
    kind: p.kind,
    durationDays: p.durationDays === null ? '' : String(p.durationDays),
    mark: p.mark,
    icon: p.icon,
    isActive: p.isActive,
    grant: p.grantCommands.join('\n'),
    revoke: p.revokeCommands.join('\n'),
    prices: {
      EUR: p.prices.EUR === null ? '' : fromMinor(p.prices.EUR),
      PLN: p.prices.PLN === null ? '' : fromMinor(p.prices.PLN)
    },
    translations: {en: tr(p.translations.en), pl: tr(p.translations.pl)}
  }
}

const lines = (text: string) =>
  text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
const price = (text: string) => (text.trim() === '' ? null : toMinor(text))
const filled = (s: string) => (s.trim() === '' ? undefined : s.trim())

/** A tab with no name, description or sections is "no translation" (null), not an empty one. */
function translation(t: TranslationForm): ProductCreate['translations']['en'] {
  if (!t.name.trim() && !t.description.trim() && t.sections.length === 0) return null
  return {
    name: t.name.trim(),
    description: t.description.trim(),
    sections: t.sections.map(s => ({
      title: s.title.trim(),
      entries: s.entries.map(e =>
        Object.fromEntries(
          Object.entries({
            cmd: filled(e.cmd),
            text: filled(e.text),
            cooldown: filled(e.cooldown)
          }).filter(([, value]) => value !== undefined)
        )
      )
    }))
  }
}

export function formToCreate(f: ProductForm): ProductCreate {
  return {
    serverId: f.serverId,
    categoryId: f.categoryId,
    slug: f.slug.trim(),
    kind: f.kind,
    durationDays: f.kind === 'TIMED' ? Number(f.durationDays) : null,
    mark: f.mark.trim(),
    icon: f.icon,
    grantCommands: lines(f.grant),
    revokeCommands: lines(f.revoke),
    prices: {EUR: price(f.prices.EUR), PLN: price(f.prices.PLN)},
    translations: {en: translation(f.translations.en), pl: translation(f.translations.pl)}
  }
}

export const formToUpdate = (f: ProductForm, version: number): ProductUpdate => ({
  ...formToCreate(f),
  isActive: f.isActive,
  version
})
