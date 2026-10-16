/** @jest-environment node */
import type {PublicRules} from '@/features/rules/types'

import {getRules} from './get-rules'

const RULES: PublicRules = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {
      id: 'chat',
      title: {value: 'Czat', lang: 'pl'},
      items: [{id: 'c1', text: {value: 'Be nice.', lang: 'en'}}]
    }
  ]
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('getRules', () => {
  it('returns the published rules for the locale, cached with the rules tag', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(RULES))
    await expect(getRules('pl')).resolves.toEqual(RULES)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/content\/rules\?locale=pl$/),
      expect.objectContaining({next: {revalidate: 60, tags: ['content-rules']}})
    )
  })

  it('returns null without logging an error when nothing is published (404)', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({code: 'not_published'}, {status: 404}))
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(getRules('en')).resolves.toBeNull()
    expect(error).not.toHaveBeenCalled()
  })

  it.each([
    ['a 500', () => Promise.resolve(new Response('x', {status: 500}))],
    ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['an invalid body', () => Promise.resolve(Response.json({sections: 'nope'}))]
  ])('returns null and logs on %s', async (_label, impl) => {
    jest.spyOn(global, 'fetch').mockImplementation(impl)
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(getRules('en')).resolves.toBeNull()
    expect(error).toHaveBeenCalled()
  })
})
