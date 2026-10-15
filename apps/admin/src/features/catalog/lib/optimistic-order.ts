import {apiErrorMessage} from '@/lib/api/error-message'
import {useState} from 'react'

/**
 * Shows a dropped item in its new place at once. The pending order is tied to the server order it
 * was made from: when a new server list arrives (the save landed) it is dropped by itself; a
 * failed save drops it at once, so the list snaps back and the error says why.
 */
export function useOptimisticOrder<T extends {id: string}>(
  items: readonly T[],
  save: (ids: string[]) => Promise<{error?: unknown}>
) {
  const base = items.map(i => i.id).join('\n')
  const [pending, setPending] = useState<{base: string; ids: string[]} | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordered =
    pending?.base === base ? pending.ids.flatMap(id => items.filter(i => i.id === id)) : [...items]

  async function move(ids: string[]) {
    setError(null)
    setPending({base, ids})
    const result = await save(ids)
    if (result.error) {
      setPending(null)
      setError(apiErrorMessage(result.error))
    }
  }

  return {items: ordered, move, error}
}
