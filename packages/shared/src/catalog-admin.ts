import * as v from 'valibot'

import {
  CURRENCIES,
  type Currency,
  LOCALES,
  type Locale,
  PRODUCT_ICONS,
  PRODUCT_KINDS,
  ProductSectionSchema
} from './catalog'

/** Same rule as the `*_slug_format` checks in the database: slugs fit the cart cookie. */
export const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/

const Id = v.pipe(v.string(), v.minLength(1))
const IdList = v.pipe(
  v.array(Id),
  v.check(ids => new Set(ids).size === ids.length, 'An id appears twice')
)
const Slug = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, 'Use 1–40 lowercase letters, digits or dashes'),
  v.description('URL segment: 1–40 of a–z, 0–9 and "-". Also stored in shoppers’ cart cookies.')
)
/** Versions are Postgres INT4; anything larger would reach the database and fail there. */
const MAX_VERSION = 2_147_483_647
const Version = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(MAX_VERSION),
  v.description('The version you read. If someone saved since, the write fails with 409 `stale`.')
)
const text = (max: number, what: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, `Enter ${what}`),
    v.maxLength(max, `Use at most ${String(max)} characters`)
  )
const Color = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-f]{6}$/i, 'Use a hex color like #ff6b1a'),
  v.description('Hex color, e.g. `#ff6b1a`')
)
const Minor = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(10_000_000),
  v.description('Price in minor units (cents or grosze): 999 means 9.99')
)

/** `{nick}` is the only placeholder the delivery worker fills in (parent spec: command injection). */
export const hasOnlyNickPlaceholder = (command: string): boolean =>
  [...command.matchAll(/\{([^{}]*)\}/g)].every(m => m[1] === 'nick')

const Command = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(200, 'Use at most 200 characters per command'),
  v.check(hasOnlyNickPlaceholder, 'Only the {nick} placeholder is allowed'),
  v.description('RCON command without a leading slash; `{nick}` becomes the buyer’s nickname')
)
const Commands = v.pipe(v.array(Command), v.maxLength(20))

/** "9.99" → 999. Accepts "9", "9.9", "9,99"; anything else (negative, 3 decimals, text) → null. */
export function toMinor(text: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** 999 → "9.99". */
export const fromMinor = (minor: number): string =>
  `${String(Math.floor(minor / 100))}.${String(minor % 100).padStart(2, '0')}`

export type MissingField = `price.${Currency}` | `translation.${Locale}`

/** What a product still lacks before it may be enabled (spec decision #5). */
export function missingForActive(p: {
  prices: Record<Currency, number | null>
  translations: Record<Locale, unknown>
}): MissingField[] {
  return [
    ...CURRENCIES.filter(c => p.prices[c] === null).map(c => `price.${c}` as const),
    ...LOCALES.filter(l => p.translations[l] === null).map(l => `translation.${l}` as const)
  ]
}

// Servers

const serverFields = {
  slug: Slug,
  name: text(40, 'a name'),
  accent: v.pipe(Color, v.description('Tab and button color on the storefront')),
  onAccent: v.pipe(Color, v.description('Text color on top of the accent'))
}
export const ServerCreateSchema = v.object(serverFields)
export const ServerUpdateSchema = v.object({
  ...serverFields,
  isActive: v.pipe(v.boolean(), v.description('Shown on the storefront')),
  version: Version
})

const CategoryRef = v.object({id: Id, slug: v.string(), name: v.string()})

export const AdminServerSchema = v.object({
  id: Id,
  slug: v.string(),
  name: v.string(),
  accent: v.string(),
  onAccent: v.string(),
  isActive: v.boolean(),
  sort: v.number(),
  version: v.number(),
  productCount: v.number(),
  categories: v.pipe(v.array(CategoryRef), v.description('Attached categories in display order')),
  rcon: v.pipe(
    v.nullable(v.object({host: v.nullable(v.string()), port: v.nullable(v.number())})),
    v.description('RCON address; null unless the viewer has `server.rcon`')
  ),
  rconPasswordSet: v.boolean()
})

export const OrderInputSchema = v.object({
  ids: v.pipe(
    IdList,
    v.minLength(1),
    v.description('Every id of the list, in the new order. A different set of ids is 409 `stale`.')
  ),
  base: v.pipe(
    IdList,
    v.minLength(1),
    v.description(
      'The order the client saw and moved from. If the current order differs, the reorder is 409 `stale`.'
    )
  )
})

export const ServerCategoriesInputSchema = v.object({
  categoryIds: v.pipe(
    IdList,
    v.description('Categories attached to the server, in display order; missing ones are detached')
  ),
  base: v.pipe(
    IdList,
    v.description(
      'The attached categories the client saw, in their order. If the current list differs, the request is 409 `stale`.'
    )
  )
})

export const RconInputSchema = v.pipe(
  v.object({
    host: v.nullable(
      v.pipe(
        v.string(),
        v.trim(),
        v.minLength(1),
        v.maxLength(253),
        v.description('Public hostname or IP of the game server; internal addresses are refused')
      )
    ),
    port: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
    password: v.optional(
      v.pipe(
        v.string(),
        v.minLength(1),
        v.maxLength(200),
        v.description('New RCON password; omit to keep the stored one')
      )
    ),
    clearPassword: v.optional(
      v.pipe(v.boolean(), v.description('true removes the stored password'))
    )
  }),
  v.check(r => (r.host === null) === (r.port === null), 'Set host and port together'),
  v.check(
    r => !(r.password !== undefined && r.clearPassword === true),
    'Send a new password or clearPassword, not both'
  )
)

export const RconTestResultSchema = v.variant('ok', [
  v.object({ok: v.literal(true), ms: v.pipe(v.number(), v.description('Round trip in ms'))}),
  v.object({
    ok: v.literal(false),
    error: v.picklist(['timeout', 'unreachable', 'auth_failed', 'decrypt_failed'])
  })
])

// Categories

const Names = v.object({en: text(40, 'an English name'), pl: text(40, 'a Polish name')})
export const CategoryInputSchema = v.object({slug: Slug, names: Names})
export const CategoryUpdateSchema = v.object({slug: Slug, names: Names, version: Version})
export const AdminCategorySchema = v.object({
  id: Id,
  slug: v.string(),
  names: v.object({en: v.string(), pl: v.string()}),
  version: v.number(),
  productCount: v.number(),
  servers: v.array(v.object({id: Id, name: v.string()}))
})

// Products

const Translation = v.object({
  name: text(60, 'a name'),
  description: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
  sections: v.pipe(v.array(ProductSectionSchema), v.maxLength(20))
})
const productFields = {
  serverId: Id,
  categoryId: v.pipe(Id, v.description('Must be attached to the server')),
  slug: Slug,
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.pipe(
    v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3650))),
    v.description('Days until revoke commands run; required for TIMED, null otherwise')
  ),
  mark: v.pipe(text(12, 'a mark'), v.description('Short wordmark on the product tile')),
  icon: v.picklist(PRODUCT_ICONS),
  grantCommands: v.pipe(Commands, v.description('Run on the game server after payment')),
  revokeCommands: v.pipe(Commands, v.description('Run when a TIMED product expires')),
  prices: v.object({EUR: v.nullable(Minor), PLN: v.nullable(Minor)}),
  translations: v.object({en: v.nullable(Translation), pl: v.nullable(Translation)})
}
const DURATION_RULE = 'A TIMED product needs durationDays; other kinds must not have it'
const durationMatchesKind = (p: {kind: string; durationDays: number | null}) =>
  (p.kind === 'TIMED') === (p.durationDays !== null)

/** Created disabled (spec decision #5), so drafts may lack prices and translations. */
export const ProductCreateSchema = v.pipe(
  v.object(productFields),
  v.check(p => durationMatchesKind(p), DURATION_RULE)
)
export const ProductUpdateSchema = v.pipe(
  v.object({
    ...productFields,
    isActive: v.pipe(
      v.boolean(),
      v.description('Shown on the storefront; needs both prices and both translations')
    ),
    version: Version
  }),
  v.check(p => durationMatchesKind(p), DURATION_RULE)
)

const TranslationOut = v.object({
  name: v.string(),
  description: v.string(),
  sections: v.array(ProductSectionSchema)
})
const PricesOut = v.object({EUR: v.nullable(v.number()), PLN: v.nullable(v.number())})
const Missing = v.pipe(
  v.array(v.picklist(['price.EUR', 'price.PLN', 'translation.en', 'translation.pl'])),
  v.description('What the product lacks before it may be enabled')
)

export const AdminProductSchema = v.object({
  id: Id,
  version: v.number(),
  sort: v.number(),
  serverId: Id,
  categoryId: Id,
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  durationDays: v.nullable(v.number()),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  isActive: v.boolean(),
  grantCommands: v.array(v.string()),
  revokeCommands: v.array(v.string()),
  prices: PricesOut,
  translations: v.object({en: v.nullable(TranslationOut), pl: v.nullable(TranslationOut)}),
  missing: Missing
})

export const AdminProductListItemSchema = v.object({
  id: Id,
  version: v.number(),
  sort: v.number(),
  serverId: Id,
  categoryId: Id,
  slug: v.string(),
  kind: v.picklist(PRODUCT_KINDS),
  mark: v.string(),
  icon: v.picklist(PRODUCT_ICONS),
  name: v.pipe(v.string(), v.description('English name, or the slug while there is none')),
  isActive: v.boolean(),
  prices: PricesOut,
  missing: Missing
})

export const ProductListQuerySchema = v.object({
  serverId: v.optional(Id),
  categoryId: v.optional(Id)
})

export const VersionQuerySchema = v.object({
  version: v.pipe(v.string(), v.regex(/^[1-9]\d*$/), v.transform(Number), v.maxValue(MAX_VERSION))
})

export type ServerCreate = v.InferOutput<typeof ServerCreateSchema>
export type ServerUpdate = v.InferOutput<typeof ServerUpdateSchema>
export type AdminServer = v.InferOutput<typeof AdminServerSchema>
export type OrderInput = v.InferOutput<typeof OrderInputSchema>
export type ServerCategoriesInput = v.InferOutput<typeof ServerCategoriesInputSchema>
export type RconInput = v.InferOutput<typeof RconInputSchema>
export type RconTestResult = v.InferOutput<typeof RconTestResultSchema>
export type CategoryInput = v.InferOutput<typeof CategoryInputSchema>
export type CategoryUpdate = v.InferOutput<typeof CategoryUpdateSchema>
export type AdminCategory = v.InferOutput<typeof AdminCategorySchema>
export type ProductCreate = v.InferOutput<typeof ProductCreateSchema>
export type ProductUpdate = v.InferOutput<typeof ProductUpdateSchema>
export type AdminProduct = v.InferOutput<typeof AdminProductSchema>
export type AdminProductListItem = v.InferOutput<typeof AdminProductListItemSchema>
export type ProductListQuery = v.InferOutput<typeof ProductListQuerySchema>
