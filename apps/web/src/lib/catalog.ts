import type {Currency} from '@/config/currencies'

import type {CatalogProduct} from '@shop/shared/catalog'

/** The id a product card and its modal share, so Motion morphs one into the other. */
export function productLayoutId(product: CatalogProduct) {
  return `product:${product.server}/${product.slug}`
}

/** The plate inside the card and inside the modal is a shared element of its own. */
export function productPlateLayoutId(product: CatalogProduct) {
  return `${productLayoutId(product)}:plate`
}

const priceFormats = new Map<string, Intl.NumberFormat>()

/** Amount first, currency after (`4.99 €`, `21.99 PLN`), whatever the locale's own order is. */
export function formatPrice(minor: number, currency: Currency, locale: string) {
  const key = `${locale}:${currency}`
  let format = priceFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, {style: 'currency', currency})
    priceFormats.set(key, format)
  }
  const parts = format.formatToParts(minor / 100)
  const symbol = parts.find(part => part.type === 'currency')?.value ?? currency
  const amount = parts
    .filter(part => part.type !== 'currency' && part.type !== 'literal')
    .map(part => part.value)
    .join('')
  return `${amount}\u00a0${symbol}`
}
