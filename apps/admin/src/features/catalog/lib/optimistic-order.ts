import {useApiError} from '@/hooks/use-error-text'
import {useState} from 'react'

/**
 * Shows a dropped item in its new place at once. The pending order is tied to the server order it
 * was made from: when a new server list arrives (the save landed) it is dropped by itself; a
 * failed save drops it at once, so the list snaps back and the error says why. `save` also gets
 * the server order (`base`), so the API can refuse a move made from a list someone else changed.
 */
export function useOptimisticOrder<T extends {id: string}>(
  items: readonly T[],
  save: (ids: string[], base: string[]) => Promise<{error?: unknown}>
) {
  const apiError = useApiError()
  const baseIds = items.map(i => i.id)
  const base = baseIds.join('\n')
  const [pending, setPending] = useState<{base: string; ids: string[]} | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordered =
    pending?.base === base ? pending.ids.flatMap(id => items.filter(i => i.id === id)) : [...items]

  async function move(ids: string[]) {
    setError(null)
    setPending({base, ids})
    const result = await save(ids, baseIds)
    if (result.error) {
      setPending(null)
      setError(apiError(result.error))
    }
  }

  return {items: ordered, move, error, base: baseIds}
}
