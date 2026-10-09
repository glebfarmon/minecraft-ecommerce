import {readFileSync} from 'node:fs'
import path from 'node:path'

import {buildOpenApiDocument} from './openapi'

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument()

  it('describes GET /api/catalog with a required locale', () => {
    const get = doc.paths['/api/catalog']?.get
    expect(get?.parameters).toEqual([
      expect.objectContaining({
        name: 'locale',
        in: 'query',
        required: true,
        schema: expect.objectContaining({enum: ['en', 'pl']})
      })
    ])
    expect(Object.keys(get?.responses ?? {})).toEqual(['200', '400'])
  })

  it('matches the committed openapi.json (run `pnpm --filter @shop/api openapi` after changing schemas)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(path.join(__dirname, '../../openapi.json'), 'utf8')
    )
    expect(committed).toEqual(doc)
  })
})
