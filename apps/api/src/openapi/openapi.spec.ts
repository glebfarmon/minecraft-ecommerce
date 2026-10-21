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
      'cursor',
      'limit'
    ])
  })

  it('explains every catalog admin operation and response', () => {
    const ops = Object.entries(doc.paths)
      .filter(([p]) => p.startsWith('/api/admin/catalog'))
      .flatMap(([p, methods]) =>
        Object.entries(methods).map(([m, op]) => ({where: `${m} ${p}`, op}))
      )
    expect(ops.length).toBe(19)
    // Each failure names the operation, so a gap is easy to find.
    const gaps = ops.flatMap(({where, op}) => [
      ...(/^[a-z]\w+$/.test(op.operationId ?? '') ? [] : [`${where}: operationId`]),
      ...(op.tags?.join() === 'Catalog admin' ? [] : [`${where}: tags`]),
      ...(op.summary.trim() ? [] : [`${where}: summary`]),
      ...(op.description?.trim() ? [] : [`${where}: description`]),
      ...Object.entries(op.responses)
        .filter(([, res]) => !res.description.trim())
        .map(([code]) => `${where}: response ${code}`)
    ])
    expect(gaps).toEqual([])
  })

  it('documents the catalog permission errors and conflicts', () => {
    const patch = doc.paths['/api/admin/catalog/products/{id}']?.patch
    expect(Object.keys(patch?.responses ?? {}).sort()).toEqual(
      ['200', '400', '401', '403', '404', '409'].sort()
    )
    expect(patch?.description).toContain('catalog.write')
    const test = doc.paths['/api/admin/catalog/servers/{id}/rcon/test']?.post
    expect(Object.keys(test?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '429', '503'])
    )
  })

  it('explains every content operation and response', () => {
    const ops = Object.entries(doc.paths)
      .filter(([p]) => p.startsWith('/api/content') || p.startsWith('/api/admin/content'))
      .flatMap(([p, methods]) =>
        Object.entries(methods).map(([m, op]) => ({where: `${m} ${p}`, p, op}))
      )
    expect(ops.length).toBe(13)
    const gaps = ops.flatMap(({where, p, op}) => [
      ...(/^[a-z]\w+$/.test(op.operationId ?? '') ? [] : [`${where}: operationId`]),
      ...(op.tags?.join() === (p.startsWith('/api/admin') ? 'Content admin' : 'Content')
        ? []
        : [`${where}: tags`]),
      ...(op.description?.trim() ? [] : [`${where}: description`]),
      ...Object.entries(op.responses)
        .filter(([, r]) => !r.description.trim())
        .map(([c]) => `${where}: ${c}`)
    ])
    expect(gaps).toEqual([])
  })

  it('matches the committed openapi.json (run `pnpm --filter @shop/api openapi` after changing schemas)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(path.join(__dirname, '../../openapi.json'), 'utf8')
    )
    expect(committed).toEqual(doc)
  })
})
