// React's `cache()` only memoizes inside a React Server Components render; under Jest the client
// build of React makes it a pass-through. Tests swap it for this per-request stand-in:
//   jest.mock('react', () => ({...jest.requireActual('react'), cache: require('@/test/request-cache').requestCache}))
// and call `newRequest()` before each test.

const stores = new Set<Map<string, unknown>>()

/** Memoizes by arguments until `newRequest()`, like React's cache within one server request. */
export function requestCache<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const store = new Map<string, unknown>()
  stores.add(store)
  return (...args: A) => {
    const key = JSON.stringify(args)
    if (!store.has(key)) store.set(key, fn(...args))
    return store.get(key) as R
  }
}

/** Starts a new request: forgets every memoized result. */
export function newRequest(): void {
  for (const store of stores) store.clear()
}
