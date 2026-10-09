'use client'

import {type ReactNode, createContext, use} from 'react'

import type {CatalogProduct, CatalogResponse, CatalogServer} from '@shop/shared/catalog'

type CatalogValue = {
  /** False when the API could not be reached and nothing was cached. */
  available: boolean
  servers: CatalogServer[]
  products: CatalogProduct[]
  findServer: (slug: string) => CatalogServer | undefined
  findProduct: (server: string, slug: string) => CatalogProduct | undefined
  categoryName: (slug: string) => string
}

const CatalogContext = createContext<CatalogValue | null>(null)

export function CatalogProvider({
  catalog,
  children
}: {
  catalog: CatalogResponse | null
  children: ReactNode
}) {
  const servers = catalog?.servers ?? []
  const products = catalog?.products ?? []
  const names = new Map(servers.flatMap(s => s.categories.map(c => [c.slug, c.name] as const)))
  const value: CatalogValue = {
    available: catalog !== null,
    servers,
    products,
    findServer: slug => servers.find(s => s.slug === slug),
    findProduct: (server, slug) => products.find(p => p.server === server && p.slug === slug),
    categoryName: slug => names.get(slug) ?? slug
  }
  return <CatalogContext value={value}>{children}</CatalogContext>
}

export function useCatalog(): CatalogValue {
  const value = use(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
