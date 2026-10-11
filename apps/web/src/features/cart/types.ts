import type {CatalogProduct} from '@shop/shared/catalog'

/** One line as stored in the `cart` cookie. */
export type CartLine = {server: string; slug: string; qty: number}

/** A cart line together with the product it points at. */
export type CartItem = {product: CatalogProduct; qty: number}
