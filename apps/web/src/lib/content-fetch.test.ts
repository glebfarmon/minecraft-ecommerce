/** @jest-environment node */
import * as v from 'valibot'

import {contentFetch} from './content-fetch'

const Schema = v.object({a: v.string()})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('contentFetch', () => {
  it('asks Next to cache the route with its tag and parses the body', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({a: 'x'}))
    await expect(contentFetch('/api/content/x', Schema, 'content-x')).resolves.toEqual({a: 'x'})
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/content/x', {
      next: {revalidate: 60, tags: ['content-x']},
      signal: expect.any(AbortSignal)
    })
  })

  it('returns null on a 404', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', {status: 404}))
    await expect(contentFetch('/api/content/x', Schema, 't')).resolves.toBeNull()
  })

  it('throws on an error status, so Next caches nothing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('x', {status: 500}))
    await expect(contentFetch('/api/content/x', Schema, 't')).rejects.toThrow('/api/content/x 500')
  })

  it('throws on an invalid body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({a: 1}))
    await expect(contentFetch('/api/content/x', Schema, 't')).rejects.toThrow()
  })
})
