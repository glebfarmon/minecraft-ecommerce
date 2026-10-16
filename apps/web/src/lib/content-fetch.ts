import {CONTENT_FETCH_TIMEOUT_MS, CONTENT_REVALIDATE_SECONDS} from '@/config/content'
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
    signal: AbortSignal.timeout(CONTENT_FETCH_TIMEOUT_MS)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${path} ${String(res.status)}`)
  return v.parse(schema, await res.json())
}

/**
 * `contentFetch` for pages: `fallback` on a 404 or any failure. A failure logs one line (no stack),
 * since every page render asks while the API is down.
 */
export async function loadContent<S extends v.GenericSchema, F>(
  path: string,
  schema: S,
  tag: string,
  fallback: F
): Promise<v.InferOutput<S> | F> {
  try {
    return (await contentFetch(path, schema, tag)) ?? fallback
  } catch (error) {
    console.error(`content ${path}: ${error instanceof Error ? error.message : String(error)}`)
    return fallback
  }
}
