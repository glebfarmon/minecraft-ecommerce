import {CART_COOKIE, CURRENCY_COOKIE} from '@/config/cart'
import {type ResolvedCart, resolveCart} from '@/features/cart/lib/resolve-cart'
import {cookies} from 'next/headers'

import type {CatalogResponse} from '@shop/shared/catalog'

/** The visitor's cart and currency from their cookies, resolved against the (cached) catalog. */
export async function loadCart(catalog: CatalogResponse | null): Promise<ResolvedCart> {
  const store = await cookies()
  return resolveCart(
    store.get(CART_COOKIE)?.value,
    store.get(CURRENCY_COOKIE)?.value,
    catalog?.products ?? []
  )
}
