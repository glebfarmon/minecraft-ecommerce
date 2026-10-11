import {type Currency, DEFAULT_CURRENCY, isCurrency} from '@/config/currencies'
import {parseCart} from '@/features/cart/lib/cart-cookie'
import type {CartItem} from '@/features/cart/types'

import type {CatalogProduct} from '@shop/shared/catalog'

export type ResolvedCart = {lines: CartItem[]; currency: Currency}

/** Cookie values + the catalog → what `ShopProvider` starts with. Lines without a product are dropped. */
export function resolveCart(
  rawCart: string | undefined,
  rawCurrency: string | undefined,
  products: readonly CatalogProduct[]
): ResolvedCart {
  const lines = parseCart(rawCart).flatMap(line => {
    const product = products.find(p => p.server === line.server && p.slug === line.slug)
    return product ? [{product, qty: line.qty}] : []
  })
  return {lines, currency: isCurrency(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY}
}
