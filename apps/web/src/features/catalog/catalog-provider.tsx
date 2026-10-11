'use client'

import {type ReactNode, createContext, use} from 'react'

import type {CatalogServer} from '@shop/shared/catalog'

type CatalogValue = {
  /** False when the API could not be reached and nothing was cached. */
  available: boolean
  servers: CatalogServer[]
  findServer: (slug: string) => CatalogServer | undefined
  categoryName: (slug: string) => string
}

const CatalogContext = createContext<CatalogValue | null>(null)

/**
 * Servers and their categories for every page. Products are not here: catalog pages pass them to
 * `<Catalog>` as a prop and the cart keeps its own, so other pages do not ship the product list.
 */
export function CatalogProvider({
  servers,
  children
}: {
  servers: CatalogServer[] | null
  children: ReactNode
}) {
  const list = servers ?? []
  const names = new Map(list.flatMap(s => s.categories.map(c => [c.slug, c.name] as const)))
  const value: CatalogValue = {
    available: servers !== null,
    servers: list,
    findServer: slug => list.find(s => s.slug === slug),
    categoryName: slug => names.get(slug) ?? slug
  }
  return <CatalogContext value={value}>{children}</CatalogContext>
}

export function useCatalog(): CatalogValue {
  const value = use(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
