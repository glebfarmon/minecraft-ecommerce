import * as v from 'valibot'

export const LOCALES = ['en', 'pl'] as const
export const CURRENCIES = ['EUR', 'PLN'] as const
export const PRODUCT_KINDS = ['PERMANENT', 'TIMED', 'CASE'] as const
export const PRODUCT_ICONS = ['crown', 'box', 'coins', 'swords', 'pickaxe', 'ticket'] as const

export const LocaleSchema = v.picklist(LOCALES)
export const CurrencySchema = v.picklist(CURRENCIES)

const MinorAmount = v.pipe(v.number(), v.integer(), v.minValue(1))

/** One line of a description block: an optional copyable command, an explanation, an optional cooldown tag. */
export const ProductEntrySchema = v.object({
  cmd: v.optional(v.string()),
  text: v.optional(v.string()),
  cooldown: v.optional(v.string())
})

export const ProductSectionSchema = v.object({
  title: v.string(),
  entries: v.array(ProductEntrySchema)
})

export const CatalogQuerySchema = v.object({locale: LocaleSchema})

export const CatalogServerSchema = v.object({
  slug: v.string(),
  name: v.string(),
  accent: v.string(),
  onAccent: v.string(),
  /** False when the server has no usable RCON: its products are listed but cannot be bought. */
  purchasable: v.boolean(),
  /** In this server's display order. */
  categories: v.array(v.object({slug: v.string(), name: v.string()}))
})

export const CatalogProductSchema = v.object({
  server: v.string(),
  category: v.string(),
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  name: v.string(),
  description: v.string(),
  sections: v.array(ProductSectionSchema),
  prices: v.strictObject({EUR: MinorAmount, PLN: MinorAmount})
})

export const CatalogResponseSchema = v.object({
  servers: v.array(CatalogServerSchema),
  products: v.array(CatalogProductSchema)
})

export type Locale = v.InferOutput<typeof LocaleSchema>
export type Currency = v.InferOutput<typeof CurrencySchema>
export type ProductKind = (typeof PRODUCT_KINDS)[number]
export type ProductIcon = (typeof PRODUCT_ICONS)[number]
export type ProductEntry = v.InferOutput<typeof ProductEntrySchema>
export type ProductSection = v.InferOutput<typeof ProductSectionSchema>
export type CatalogQuery = v.InferOutput<typeof CatalogQuerySchema>
export type CatalogServer = v.InferOutput<typeof CatalogServerSchema>
export type CatalogProduct = v.InferOutput<typeof CatalogProductSchema>
export type CatalogResponse = v.InferOutput<typeof CatalogResponseSchema>
