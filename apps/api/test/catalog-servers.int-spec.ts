import request from 'supertest'

import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

type ServerBody = {id: string; slug: string; version: number; categories: {id: string}[]}

describe('catalog servers API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const ids = async () =>
    (await ctx.prisma.server.findMany({orderBy: {sort: 'asc'}})).map(s => s.id)
  const storefrontServers = async () =>
    (
      (await request(ctx.app.getHttpServer()).get('/api/catalog?locale=en').expect(200)).body as {
        servers: {slug: string; categories: {slug: string}[]}[]
      }
    ).servers

  it('lists servers in order and hides RCON from admins without server.rcon', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const res = await editor.get('/api/admin/catalog/servers').expect(200)
    const list = res.body as (ServerBody & {rcon: unknown; productCount: number})[]
    expect(list.map(s => s.slug)).toEqual(['survival', 'anarchy', 'minigames'])
    expect(list[0]).toMatchObject({rcon: null, rconPasswordSet: false})
    expect(list[0]?.productCount).toBeGreaterThan(0)
    const owner = await ctx.admin('OWNER')
    const one = await owner.get(`/api/admin/catalog/servers/${list[0]?.id ?? ''}`).expect(200)
    expect(one.body).toMatchObject({rcon: {host: null, port: null}})
  })

  it('creates a disabled server at the end and updates it with a version', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const created = await editor
      .post('/api/admin/catalog/servers')
      .send({slug: 'skyblock', name: 'Skyblock', accent: '#2266ff', onAccent: '#ffffff'})
      .expect(201)
    const server = created.body as ServerBody & {isActive: boolean; sort: number}
    expect(server).toMatchObject({isActive: false, version: 1, categories: []})
    expect(server.sort).toBe(3)
    await editor
      .patch(`/api/admin/catalog/servers/${server.id}`)
      .send({
        slug: 'sky',
        name: 'Sky',
        accent: '#2266ff',
        onAccent: '#ffffff',
        isActive: false,
        version: 1
      })
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({slug: 'sky', version: 2})
      })
    await editor.delete(`/api/admin/catalog/servers/${server.id}?version=2`).expect(204)
  })

  it('locks the slug of an enabled server', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})
    await editor
      .patch(`/api/admin/catalog/servers/${survival.id}`)
      .send({
        slug: 'survival-2',
        name: survival.name,
        accent: survival.accent,
        onAccent: survival.onAccent,
        isActive: true,
        version: survival.version
      })
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
  })

  it('will not delete a server that has products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})
    await editor
      .delete(`/api/admin/catalog/servers/${survival.id}?version=${String(survival.version)}`)
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'in_use'})
      })
  })

  it('reorders servers and the storefront follows; a stale list is refused', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const before = await ids()
    const reversed = [...before].reverse()
    await editor.put('/api/admin/catalog/servers/order').send({ids: reversed}).expect(200)
    expect(await ids()).toEqual(reversed)
    expect((await storefrontServers()).map(s => s.slug)).toEqual([
      'minigames',
      'anarchy',
      'survival'
    ])
    await editor
      .put('/api/admin/catalog/servers/order')
      .send({ids: reversed.slice(1)})
      .expect(409)
    expect(await ids()).toEqual(reversed)
    await editor.put('/api/admin/catalog/servers/order').send({ids: before}).expect(200)
  })

  it('reorders and attaches categories, but will not detach one with products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({
      where: {slug: 'survival'},
      include: {categories: {orderBy: {sort: 'asc'}}}
    })
    const current = survival.categories.map(c => c.categoryId)
    const tools = await ctx.prisma.category.create({
      data: {
        slug: 'tools-s',
        translations: {
          create: [
            {locale: 'en', name: 'Tools'},
            {locale: 'pl', name: 'Narzędzia'}
          ]
        }
      }
    })
    const next = [tools.id, ...[...current].reverse()]
    const res = await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: next})
      .expect(200)
    expect((res.body as ServerBody).categories.map(c => c.id)).toEqual(next)
    expect((await storefrontServers()).find(s => s.slug === 'survival')?.categories[0]?.slug).toBe(
      'tools-s'
    )

    const blocked = await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: [tools.id]})
      .expect(409)
    expect(blocked.body).toMatchObject({
      message: 'in_use',
      issues: {products: expect.any(Number) as number}
    })

    await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: current})
      .expect(200)
  })

  it('refuses an unknown category', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const survival = await ctx.prisma.server.findUniqueOrThrow({
      where: {slug: 'survival'},
      include: {categories: true}
    })
    await editor
      .put(`/api/admin/catalog/servers/${survival.id}/categories`)
      .send({categoryIds: [...survival.categories.map(c => c.categoryId), 'nope']})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'unknown_category'})
      })
  })
})
