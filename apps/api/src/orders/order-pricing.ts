import type {Currency, Locale} from '@shop/shared/catalog'
import type {CreateOrderRequest} from '@shop/shared/orders'

export type PricedItem = {
  productId: string
  serverId: string
  quantity: number
  unitAmountMinor: number
  productName: string
  serverName: string
}

/** The product rows the service loads: with their server, the order currency's price and names. */
export type PricingProduct = {
  id: string
  slug: string
  isActive: boolean
  serverId: string
  server: {slug: string; name: string; isActive: boolean}
  prices: {currency: Currency; amountMinor: number}[]
  translations: {locale: Locale; name: string}[]
}

type Line = CreateOrderRequest['lines'][number]

/** Prices come only from `products`; the client sends slugs and quantities. */
export function priceLines(
  lines: Line[],
  products: PricingProduct[],
  currency: Currency,
  locale: Locale
): {items: PricedItem[]} | {unavailable: {server: string; slug: string}[]} {
  const items: PricedItem[] = []
  const unavailable: {server: string; slug: string}[] = []
  for (const line of lines) {
    const product = products.find(p => p.slug === line.slug && p.server.slug === line.server)
    const price = product?.prices.find(p => p.currency === currency)
    const name = (
      product?.translations.find(t => t.locale === locale) ??
      product?.translations.find(t => t.locale === 'en')
    )?.name
    if (!product || !product.isActive || !product.server.isActive || !price || name === undefined) {
      unavailable.push({server: line.server, slug: line.slug})
      continue
    }
    items.push({
      productId: product.id,
      serverId: product.serverId,
      quantity: line.quantity,
      unitAmountMinor: price.amountMinor,
      productName: name,
      serverName: product.server.name
    })
  }
  return unavailable.length > 0 ? {unavailable} : {items}
}
