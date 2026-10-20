import {FORM_MESSAGES} from '@/lib/validation-messages'
import * as v from 'valibot'

import {PRODUCT_ICONS, PRODUCT_KINDS} from '@shop/shared/catalog'
import {SLUG_PATTERN, hasOnlyNickPlaceholder, toMinor} from '@shop/shared/catalog-admin'
import {VALIDATION_MESSAGES} from '@shop/shared/validation-messages'

export const SlugField = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, VALIDATION_MESSAGES.slugFormat)
)
const Name = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, VALIDATION_MESSAGES.enterName),
  v.maxLength(40, VALIDATION_MESSAGES.atMost40)
)

export const CategoryFormSchema = v.object({slug: SlugField, en: Name, pl: Name})
export type CategoryForm = v.InferOutput<typeof CategoryFormSchema>

const PriceText = v.pipe(
  v.string(),
  v.trim(),
  v.check(t => t === '' || toMinor(t) !== null, FORM_MESSAGES.priceFormat)
)
const CommandLines = v.pipe(
  v.string(),
  v.check(
    t => t.split('\n').every(line => hasOnlyNickPlaceholder(line)),
    VALIDATION_MESSAGES.onlyNickPlaceholder
  ),
  v.check(
    t => t.split('\n').every(line => line.trim().length <= 200),
    VALIDATION_MESSAGES.commandTooLong
  )
)
const EntryForm = v.object({cmd: v.string(), text: v.string(), cooldown: v.string()})
const SectionForm = v.object({title: v.string(), entries: v.array(EntryForm)})
const TranslationForm = v.object({
  name: v.pipe(v.string(), v.maxLength(60, VALIDATION_MESSAGES.atMost60)),
  description: v.pipe(v.string(), v.maxLength(2000, VALIDATION_MESSAGES.atMost2000)),
  sections: v.array(SectionForm)
})

export const ProductFormSchema = v.pipe(
  v.object({
    serverId: v.pipe(v.string(), v.minLength(1, FORM_MESSAGES.chooseServer)),
    categoryId: v.pipe(v.string(), v.minLength(1, FORM_MESSAGES.chooseCategory)),
    slug: SlugField,
    kind: v.picklist(PRODUCT_KINDS),
    durationDays: v.pipe(v.string(), v.trim()),
    mark: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, VALIDATION_MESSAGES.enterMark),
      v.maxLength(12, VALIDATION_MESSAGES.atMost12)
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
      FORM_MESSAGES.timedDays
    ),
    ['durationDays']
  )
)
export type ProductForm = v.InferInput<typeof ProductFormSchema>

const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i, VALIDATION_MESSAGES.hexColor))
export const ServerFormSchema = v.object({
  slug: SlugField,
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, VALIDATION_MESSAGES.enterName),
    v.maxLength(40, VALIDATION_MESSAGES.atMost40)
  ),
  accent: Hex,
  onAccent: Hex,
  isActive: v.boolean()
})
export type ServerForm = v.InferOutput<typeof ServerFormSchema>

export const RconFormSchema = v.object({
  host: v.pipe(v.string(), v.trim(), v.maxLength(253, VALIDATION_MESSAGES.atMost253)),
  port: v.pipe(
    v.string(),
    v.trim(),
    v.check(
      p => p === '' || (/^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 65535),
      FORM_MESSAGES.portRange
    )
  ),
  password: v.string(),
  clearPassword: v.boolean()
})
export type RconForm = v.InferOutput<typeof RconFormSchema>
