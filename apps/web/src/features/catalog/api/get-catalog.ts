import type {Locale} from '@/i18n/routing'
import * as v from 'valibot'

import {type CatalogResponse, CatalogResponseSchema} from '@shop/shared/catalog'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

/** Public catalog for `locale`, cached by Next for 60 s per locale (ADR 0007). Throws on failure, so no error is cached. */
export async function getCatalog(locale: Locale): Promise<CatalogResponse> {
  const res = await fetch(`${API_ORIGIN}/api/catalog?locale=${locale}`, {
    next: {revalidate: 60, tags: ['catalog']}
  })
  if (!res.ok) throw new Error(`catalog ${String(res.status)}`)
  return v.parse(CatalogResponseSchema, await res.json())
}

/** For layouts and pages: `null` when the API cannot answer, so the shop renders as unavailable instead of a 500. */
export async function loadCatalog(locale: Locale): Promise<CatalogResponse | null> {
  try {
    return await getCatalog(locale)
  } catch (error) {
    console.error(error)
    return null
  }
}
