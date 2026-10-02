// Demo catalog. Every value here is placeholder data until the catalog API
// (sub-project 2) exists; the UI labels it as demo.

export type CategoryId = 'ranks' | 'cases' | 'currency' | 'kits' | 'cosmetics'

export type Server = {
  slug: string
  name: string
  accent: string
  onAccent: string
  /** Shop categories on this server, in display order. A category may have no products yet. */
  categories: CategoryId[]
}

const survival: Server = {
  slug: 'survival',
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#0e0e10',
  categories: ['ranks', 'cases', 'currency', 'kits']
}

export const servers: Server[] = [
  survival,
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

export const defaultServer = survival
