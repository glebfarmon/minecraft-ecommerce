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

  it('documents every admin route', () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/admin/me',
        '/api/admin/admins',
        '/api/admin/admins/{id}',
        '/api/admin/admins/{id}/role',
        '/api/admin/admins/{id}/reset-2fa',
        '/api/admin/invites',
        '/api/admin/invites/{id}',
        '/api/admin/invites/{id}/resend',
        '/api/admin/roles',
        '/api/admin/roles/{id}',
        '/api/admin/audit',
        '/api/invite-lookup/{token}'
      ])
    )
  })

  it('describes bodies and path parameters of the admin routes', () => {
    const patch = doc.paths['/api/admin/admins/{id}/role']?.patch
    expect(patch?.parameters).toEqual([
      expect.objectContaining({name: 'id', in: 'path', required: true})
    ])
    expect(patch?.requestBody?.content['application/json'].schema).toEqual(
      expect.objectContaining({required: ['roleId']})
    )
    expect(Object.keys(doc.paths['/api/admin/roles/{id}']?.delete?.responses ?? {})).toContain(
      '204'
    )
    expect(doc.paths['/api/admin/audit']?.get?.parameters?.map(p => p.name)).toEqual([
      'actorId',
      'action',
      'from',
      'to',
      'cursor'
    ])
  })

  it('matches the committed openapi.json (run `pnpm --filter @shop/api openapi` after changing schemas)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(path.join(__dirname, '../../openapi.json'), 'utf8')
    )
    expect(committed).toEqual(doc)
  })
})
