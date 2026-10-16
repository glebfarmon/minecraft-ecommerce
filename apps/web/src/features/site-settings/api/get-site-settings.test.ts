/** @jest-environment node */
import {DEFAULT_SITE_SETTINGS} from '@/config/site'
import {newRequest} from '@/test/request-cache'

import {getSiteSettings} from './get-site-settings'

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

describe('getSiteSettings', () => {
  it('returns the API settings and asks Next to cache them with the content tag', async () => {
    const live = {
      siteName: {plain: 'Mine', accent: 'craft'},
      serverIp: 'play.example.com',
      discordUrl: 'https://discord.gg/x',
      supportEmail: 'a@b.co'
    }
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(live))
    await expect(getSiteSettings()).resolves.toEqual(live)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/content\/settings$/),
      expect.objectContaining({next: {revalidate: 60, tags: ['content-settings']}})
    )
  })

  it('fetches once per request however many components ask', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json(DEFAULT_SITE_SETTINGS))
    await Promise.all([getSiteSettings(), getSiteSettings()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 500', () => Promise.resolve(new Response('x', {status: 500}))],
    ['a 404', () => Promise.resolve(new Response('x', {status: 404}))],
    ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['an invalid body', () => Promise.resolve(Response.json({nope: true}))]
  ])('falls back to the defaults on %s', async (_label, impl) => {
    jest.spyOn(global, 'fetch').mockImplementation(impl)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS)
  })

  it('keeps the current brand values', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({
      siteName: {plain: 'Block', accent: 'haus'},
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example'
    })
  })
})
