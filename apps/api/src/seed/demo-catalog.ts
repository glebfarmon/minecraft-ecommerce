import type {Locale} from '@shop/shared/catalog'

export type CategoryId = 'ranks' | 'cases' | 'currency' | 'kits' | 'cosmetics'

export const DEMO_CATEGORIES: {slug: CategoryId; names: Record<Locale, string>}[] = [
  {slug: 'ranks', names: {en: 'Ranks', pl: 'Rangi'}},
  {slug: 'cases', names: {en: 'Cases', pl: 'Skrzynki'}},
  {slug: 'currency', names: {en: 'Currency', pl: 'Waluta'}},
  {slug: 'kits', names: {en: 'Kits', pl: 'Zestawy'}},
  {slug: 'cosmetics', names: {en: 'Cosmetics', pl: 'Kosmetyki'}}
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
