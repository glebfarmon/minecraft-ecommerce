import * as v from 'valibot'

import {PRODUCT_ICONS, PRODUCT_KINDS} from '@shop/shared/catalog'
import {SLUG_PATTERN, hasOnlyNickPlaceholder, toMinor} from '@shop/shared/catalog-admin'

export const SlugField = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, 'Use 1–40 lowercase letters, digits or dashes')
)
const Name = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a name'),
  v.maxLength(40, 'Use at most 40 characters')
)

export const CategoryFormSchema = v.object({slug: SlugField, en: Name, pl: Name})
export type CategoryForm = v.InferOutput<typeof CategoryFormSchema>

const PriceText = v.pipe(
  v.string(),
  v.trim(),
  v.check(t => t === '' || toMinor(t) !== null, 'Use a price like 9.99')
)
const CommandLines = v.pipe(
  v.string(),
  v.check(
    t => t.split('\n').every(line => hasOnlyNickPlaceholder(line)),
    'Only the {nick} placeholder is allowed'
  ),
  v.check(
    t => t.split('\n').every(line => line.trim().length <= 200),
    'Use at most 200 characters per command'
  )
)
const EntryForm = v.object({cmd: v.string(), text: v.string(), cooldown: v.string()})
const SectionForm = v.object({title: v.string(), entries: v.array(EntryForm)})
const TranslationForm = v.object({
  name: v.pipe(v.string(), v.maxLength(60, 'Use at most 60 characters')),
  description: v.pipe(v.string(), v.maxLength(2000, 'Use at most 2000 characters')),
  sections: v.array(SectionForm)
})

export const ProductFormSchema = v.pipe(
  v.object({
    serverId: v.pipe(v.string(), v.minLength(1, 'Choose a server')),
    categoryId: v.pipe(v.string(), v.minLength(1, 'Choose a category')),
    slug: SlugField,
    kind: v.picklist(PRODUCT_KINDS),
    durationDays: v.pipe(v.string(), v.trim()),
    mark: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, 'Enter a mark'),
      v.maxLength(12, 'Use at most 12 characters')
    ),
    icon: v.picklist(PRODUCT_ICONS),
    isActive: v.boolean(),
    grant: CommandLines,
    revoke: CommandLines,
    prices: v.object({EUR: PriceText, PLN: PriceText}),
    translations: v.object({en: TranslationForm, pl: TranslationForm})
  }),
  v.forward(
    v.partialCheck(
      [['kind'], ['durationDays']],
      f => (f.kind === 'TIMED') === /^[1-9]\d*$/.test(f.durationDays),
      'TIMED products need a number of days; other kinds leave it empty'
    ),
    ['durationDays']
  )
)
export type ProductForm = v.InferInput<typeof ProductFormSchema>

const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i, 'Use a hex color like #ff6b1a'))
export const ServerFormSchema = v.object({
  slug: SlugField,
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Enter a name'),
    v.maxLength(40, 'Use at most 40 characters')
  ),
  accent: Hex,
  onAccent: Hex,
  isActive: v.boolean()
})
export type ServerForm = v.InferOutput<typeof ServerFormSchema>

export const RconFormSchema = v.object({
  host: v.pipe(v.string(), v.trim(), v.maxLength(253)),
  port: v.pipe(
    v.string(),
    v.trim(),
    v.check(
      p => p === '' || (/^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 65535),
      'Use a port between 1 and 65535'
    )
  ),
  password: v.string(),
  clearPassword: v.boolean()
})
export type RconForm = v.InferOutput<typeof RconFormSchema>
