import type {Locale, ProductIcon} from '@shop/shared/catalog'

export type CategoryId = 'ranks' | 'cases' | 'currency' | 'kits' | 'cosmetics'

/** `icon` is drawn on every product tile of the category. */
export const DEMO_CATEGORIES: {
  slug: CategoryId
  names: Record<Locale, string>
  icon: ProductIcon
}[] = [
  {slug: 'ranks', names: {en: 'Ranks', pl: 'Rangi'}, icon: 'crown'},
  {slug: 'cases', names: {en: 'Cases', pl: 'Skrzynki'}, icon: 'box'},
  {slug: 'currency', names: {en: 'Currency', pl: 'Waluta'}, icon: 'coins'},
  {slug: 'kits', names: {en: 'Kits', pl: 'Zestawy'}, icon: 'pickaxe'},
  {slug: 'cosmetics', names: {en: 'Cosmetics', pl: 'Kosmetyki'}, icon: 'ticket'}
]

/** Servers in display order; `categories` in each server's own order (a category may have no products). */
export const DEMO_SERVERS: {
  slug: string
  name: string
  accent: string
  onAccent: string
  categories: CategoryId[]
}[] = [
  {
    slug: 'survival',
    name: 'Survival',
    accent: '#ff6b1a',
    onAccent: '#0e0e10',
    categories: ['ranks', 'cases', 'currency', 'kits']
  },
  {
    slug: 'anarchy',
    name: 'Anarchy',
    accent: '#7b3ff2',
    onAccent: '#ffffff',
    categories: ['kits', 'ranks', 'cases', 'currency']
  },
  {
    slug: 'minigames',
    name: 'Minigames',
    accent: '#d92b52',
    onAccent: '#ffffff',
    categories: ['ranks', 'cases', 'currency', 'cosmetics']
  }
]
