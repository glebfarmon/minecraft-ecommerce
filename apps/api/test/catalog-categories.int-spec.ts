import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

describe('catalog categories API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const body = {slug: 'tools', names: {en: 'Tools', pl: 'Narzędzia'}}

  it('lists categories with names, servers and product counts for any admin', async () => {
    const support = await ctx.admin('SUPPORT')
    const res = await support.get('/api/admin/catalog/categories').expect(200)
    const ranks = (res.body as {slug: string}[]).find(c => c.slug === 'ranks')
    expect(ranks).toMatchObject({
      names: {en: 'Ranks', pl: 'Rangi'},
      version: 1,
      productCount: expect.any(Number) as number,
      servers: expect.arrayContaining([expect.objectContaining({name: 'Survival'})]) as unknown
    })
  })

  it('refuses writes without catalog.write', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.post('/api/admin/catalog/categories').send(body).expect(403)
  })

  it('creates, renames and deletes a category, auditing each step', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const created = await editor.post('/api/admin/catalog/categories').send(body).expect(201)
    const id = (created.body as {id: string}).id
    expect(created.body).toMatchObject({slug: 'tools', version: 1, productCount: 0, servers: []})

    const renamed = await editor
      .patch(`/api/admin/catalog/categories/${id}`)
      .send({...body, names: {en: 'Gear', pl: 'Sprzęt'}, version: 1})
      .expect(200)
    expect(renamed.body).toMatchObject({names: {en: 'Gear', pl: 'Sprzęt'}, version: 2})

    await editor
      .patch(`/api/admin/catalog/categories/${id}`)
      .send({...body, version: 1})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })

    await editor.delete(`/api/admin/catalog/categories/${id}?version=2`).expect(204)
    const rows = await ctx.prisma.auditLog.findMany({where: {entityId: id}})
    expect(rows.map(r => r.action).sort()).toEqual(
      ['category.create', 'category.delete', 'category.update'].sort()
    )
  })

  it('answers 409 slug_taken for a duplicate slug', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    await editor
      .post('/api/admin/catalog/categories')
      .send({...body, slug: 'ranks'})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_taken'})
      })
  })

  it('will not delete a category that still has products', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    const ranks = await ctx.prisma.category.findUniqueOrThrow({where: {slug: 'ranks'}})
    const res = await editor
      .delete(`/api/admin/catalog/categories/${ranks.id}?version=${String(ranks.version)}`)
      .expect(409)
    expect(res.body).toMatchObject({
      message: 'in_use',
      issues: {products: expect.any(Number) as number}
    })
  })
})
