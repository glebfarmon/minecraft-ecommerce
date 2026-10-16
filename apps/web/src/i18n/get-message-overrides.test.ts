/** @jest-environment node */
import {newRequest} from '@/test/request-cache'

import {getMessageOverrides} from './get-message-overrides'

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot import
  cache: (require('@/test/request-cache') as typeof import('@/test/request-cache')).requestCache
}))

beforeEach(() => {
  newRequest()
})
afterEach(() => {
  jest.restoreAllMocks()
})

describe('getMessageOverrides', () => {
  it('returns the override map for the locale, cached with the messages tag', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({'hero.title': 'Hi'}))
    await expect(getMessageOverrides('pl')).resolves.toEqual({'hero.title': 'Hi'})
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/content\/messages\?locale=pl$/),
      expect.objectContaining({next: {revalidate: 60, tags: ['content-messages']}})
    )
  })

  it('fetches once per request however many components ask', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({}))
    await Promise.all([getMessageOverrides('pl'), getMessageOverrides('pl')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 500', () => Promise.resolve(new Response('x', {status: 500}))],
    ['a 404', () => Promise.resolve(new Response('x', {status: 404}))],
    ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['an invalid body', () => Promise.resolve(Response.json({'hero.title': 1}))]
  ])('returns no overrides on %s', async (_label, impl) => {
    jest.spyOn(global, 'fetch').mockImplementation(impl)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(getMessageOverrides('en')).resolves.toEqual({})
  })
})
