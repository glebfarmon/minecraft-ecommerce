import {CONTENT_REVALIDATE_SECONDS} from '@/config/content'
import * as v from 'valibot'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

/**
 * Cached GET of a public content route (ADR 0007/0008). 404 → `null`; any other failure throws, so Next never
 * caches an error — callers catch it outside and fall back.
 */
export async function contentFetch<S extends v.GenericSchema>(
  path: string,
  schema: S,
  tag: string
): Promise<v.InferOutput<S> | null> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    next: {revalidate: CONTENT_REVALIDATE_SECONDS, tags: [tag]},
    signal: AbortSignal.timeout(5000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${path} ${String(res.status)}`)
  return v.parse(schema, await res.json())
}
