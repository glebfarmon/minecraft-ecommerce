/** @jest-environment node */
import {TEST_CATALOG} from '@/features/catalog/test-catalog'

import {getCatalog, loadCatalog} from './get-catalog'

jest.mock('@/config/catalog', () => ({CATALOG_REVALIDATE_SECONDS: 7}))

const respond = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), {status}))

afterEach(() => {
  jest.restoreAllMocks()
})

describe('getCatalog', () => {
  it('fetches the locale with the configured tagged cache and parses the body', async () => {
    const fetchMock = respond(200, TEST_CATALOG)
    await expect(getCatalog('pl')).resolves.toEqual(TEST_CATALOG)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/catalog?locale=pl', {
      next: {revalidate: 7, tags: ['catalog']},
      signal: expect.any(AbortSignal)
    })
  })

  it('throws on an error status so the failure is not cached', async () => {
    respond(503, {})
    await expect(getCatalog('en')).rejects.toThrow('catalog 503')
  })

  it('throws on a malformed body', async () => {
    respond(200, {servers: 'nope'})
    await expect(getCatalog('en')).rejects.toThrow()
  })
})

describe('loadCatalog', () => {
  it('returns null instead of throwing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadCatalog('en')).resolves.toBeNull()
  })
})
