import type {Currency} from '@/config/currencies'
import {products} from '@/config/products'
import {servers} from '@/config/servers'

export function findServer(slug: string) {
  return servers.find(s => s.slug === slug)
}

export function findProduct(server: string, slug: string) {
  return products.find(p => p.server === server && p.slug === slug)
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
