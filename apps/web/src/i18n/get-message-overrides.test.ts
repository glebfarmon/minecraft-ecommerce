/** @jest-environment node */
import {getMessageOverrides} from './get-message-overrides'

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
