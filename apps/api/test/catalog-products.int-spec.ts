import request from 'supertest'

import {startCatalogApp} from './support/catalog-app'

jest.setTimeout(180_000)

type ProductBody = {id: string; version: number; isActive: boolean; missing: string[]; sort: number}

describe('catalog products API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  let survival = ''
  let anarchy = ''
  let ranks = ''
  let editor: Awaited<ReturnType<typeof ctx.admin>>

  beforeAll(async () => {
    ctx = await startCatalogApp()
    survival = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})).id
    anarchy = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'anarchy'}})).id
    ranks = (await ctx.prisma.category.findUniqueOrThrow({where: {slug: 'ranks'}})).id
    editor = await ctx.admin({permissions: ['catalog.write']})
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const en = {
    name: 'Probe',
    description: 'A test rank',
    sections: [{title: 'Perks', entries: [{cmd: '/fly'}]}]
  }
  const draft = () => ({
    serverId: survival,
    categoryId: ranks,
    slug: `probe-${String(Date.now())}`,
    kind: 'TIMED',
    durationDays: 30,
    mark: 'PRB',
    grantCommands: ['lp user {nick} parent addtemp probe 30d'],
    revokeCommands: ['lp user {nick} parent remove probe'],
    prices: {EUR: 499, PLN: null},
    translations: {en, pl: null}
  })
  const storefront = async () =>
    (
      (await request(ctx.app.getHttpServer()).get('/api/catalog?locale=en').expect(200)).body as {
        products: {slug: string; server: string}[]
      }
    ).products

  it('creates a disabled draft at the end of its list, hidden from the storefront', async () => {
    const body = draft()
    const res = await editor.post('/api/admin/catalog/products').send(body).expect(201)
    const p = res.body as ProductBody
    expect(p).toMatchObject({isActive: false, version: 1, missing: ['price.PLN', 'translation.pl']})
    const others = await ctx.prisma.product.count({where: {serverId: survival, categoryId: ranks}})
    expect(p.sort).toBe(others - 1)
    expect((await storefront()).some(s => s.slug === body.slug)).toBe(false)
  })

  it('will not enable an incomplete product and lists what is missing', async () => {
    const created = (await editor.post('/api/admin/catalog/products').send(draft()).expect(201))
      .body as ProductBody
    const res = await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...draft(), isActive: true, version: 1})
      .expect(400)
    expect(res.body).toMatchObject({
      message: 'incomplete',
      issues: {missing: ['price.PLN', 'translation.pl']}
    })
  })

  it('enables a complete product and the storefront shows it', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {
      ...body,
      prices: {EUR: 499, PLN: 2199},
      translations: {en, pl: {...en, name: 'Sonda'}}
    }
    const res = await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    expect(res.body).toMatchObject({isActive: true, version: 2, missing: []})
    expect((await storefront()).some(s => s.slug === body.slug)).toBe(true)
  })

  it('keeps an enabled product complete: clearing a translation is 400 and changes nothing', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {...body, prices: {EUR: 499, PLN: 2199}, translations: {en, pl: en}}
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, translations: {en, pl: null}, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        expect((res.body as {message: string}).message).toBe('incomplete')
      })
    const stored = await ctx.prisma.productTranslation.count({where: {productId: created.id}})
    expect(stored).toBe(2)
    const row = await ctx.prisma.product.findUniqueOrThrow({
      where: {id: created.id},
      include: {prices: true}
    })
    expect(row.version).toBe(2)
    expect(row.prices.map(p => [p.currency, p.amountMinor]).sort()).toEqual([
      ['EUR', 499],
      ['PLN', 2199]
    ])
  })

  it('keeps an enabled product complete: clearing a price is 400 and the price row stays', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {...body, prices: {EUR: 499, PLN: 2199}, translations: {en, pl: en}}
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, prices: {EUR: 499, PLN: null}, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        const b = res.body as {message: string; issues: {missing: string[]}}
        expect(b.message).toBe('incomplete')
        expect(b.issues.missing).toEqual(['price.PLN'])
      })
    const prices = await ctx.prisma.price.findMany({where: {productId: created.id}})
    expect(prices.map(p => p.currency).sort()).toEqual(['EUR', 'PLN'])
  })

  it('locks slug and server of an enabled product', async () => {
    const body = draft()
    const created = (await editor.post('/api/admin/catalog/products').send(body).expect(201))
      .body as ProductBody
    const complete = {...body, prices: {EUR: 499, PLN: 2199}, translations: {en, pl: en}}
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, isActive: true, version: 1})
      .expect(200)
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, slug: `${body.slug}-x`, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
    await editor
      .patch(`/api/admin/catalog/products/${created.id}`)
      .send({...complete, serverId: anarchy, isActive: true, version: 2})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'slug_locked'})
      })
  })

  it('refuses a category that is not attached to the server', async () => {
    const lonely = await ctx.prisma.category.create({
      data: {
        slug: 'lonely',
        translations: {
          create: [
            {locale: 'en', name: 'L'},
            {locale: 'pl', name: 'L'}
          ]
        }
      }
    })
    await editor
      .post('/api/admin/catalog/products')
      .send({...draft(), categoryId: lonely.id})
      .expect(400)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'category_not_on_server'})
      })
  })

  it('refuses another placeholder in a command', async () => {
    await editor
      .post('/api/admin/catalog/products')
      .send({...draft(), grantCommands: ['give {player} diamond']})
      .expect(400)
  })

  it('answers 409 stale for an old version and deletes with the current one', async () => {
    const created = (await editor.post('/api/admin/catalog/products').send(draft()).expect(201))
      .body as ProductBody
    await editor.delete(`/api/admin/catalog/products/${created.id}?version=7`).expect(409)
    await editor.delete(`/api/admin/catalog/products/${created.id}?version=1`).expect(204)
    await editor.get(`/api/admin/catalog/products/${created.id}`).expect(404)
  })

  it('refuses to delete a product that an order references', async () => {
    const created = (await editor.post('/api/admin/catalog/products').send(draft()).expect(201))
      .body as ProductBody
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: {id: created.id},
      include: {server: true}
    })
    await ctx.prisma.order.create({
      data: {
        publicId: `d${String(Date.now()).padStart(21, '0')}`,
        nick: 'Steve',
        email: 'steve@example.com',
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 499,
        totalMinor: 499,
        deliveryConsentAt: new Date(),
        items: {
          create: {
            productId: product.id,
            serverId: product.serverId,
            quantity: 1,
            unitAmountMinor: 499,
            productName: 'VIP',
            serverName: product.server.name
          }
        }
      }
    })
    const res = await editor
      .delete(`/api/admin/catalog/products/${created.id}?version=${String(created.version)}`)
      .expect(409)
    expect(res.body).toMatchObject({message: 'in_use', issues: {orders: 1}})
  })

  it('lists products of one server and category in order for any admin', async () => {
    const support = await ctx.admin('SUPPORT')
    const res = await support
      .get(`/api/admin/catalog/products?serverId=${survival}&categoryId=${ranks}`)
      .expect(200)
    const list = res.body as {sort: number; name: string; serverId: string}[]
    expect(list.length).toBeGreaterThan(0)
    expect(list.every(p => p.serverId === survival)).toBe(true)
    expect(list.map(p => p.sort)).toEqual([...list.map(p => p.sort)].sort((a, b) => a - b))
    await support.post('/api/admin/catalog/products').send(draft()).expect(403)
  })

  it('reorders a category and the storefront follows; an out-of-date list changes nothing', async () => {
    const listUrl = `/api/admin/catalog/products?serverId=${survival}&categoryId=${ranks}`
    const orderUrl = `/api/admin/catalog/servers/${survival}/categories/${ranks}/products/order`
    const ids = ((await editor.get(listUrl).expect(200)).body as {id: string}[]).map(p => p.id)
    const reversed = [...ids].reverse()

    const res = await editor.put(orderUrl).send({ids: reversed, base: ids}).expect(200)
    expect((res.body as {id: string}[]).map(p => p.id)).toEqual(reversed)

    const activeSlugs = (
      await ctx.prisma.product.findMany({
        where: {serverId: survival, categoryId: ranks, isActive: true},
        orderBy: {sort: 'asc'},
        select: {slug: true}
      })
    ).map(p => p.slug)
    const shown = (await storefront()).filter(p => activeSlugs.includes(p.slug)).map(p => p.slug)
    expect(shown).toEqual(activeSlugs)

    await editor
      .put(orderUrl)
      .send({ids: reversed.slice(1), base: reversed})
      .expect(409)
    await editor
      .put(orderUrl)
      .send({ids: [...reversed.slice(1), 'stranger'], base: reversed})
      .expect(409)
    // Same set, but made from the order before the save above: someone else's reorder wins.
    await editor
      .put(orderUrl)
      .send({ids, base: ids})
      .expect(409)
      .expect(r => {
        expect(r.body).toMatchObject({message: 'stale'})
      })
    const after = ((await editor.get(listUrl).expect(200)).body as {id: string}[]).map(p => p.id)
    expect(after).toEqual(reversed)

    const audit = await ctx.prisma.auditLog.findFirstOrThrow({
      where: {action: 'product.order'},
      orderBy: {createdAt: 'desc'}
    })
    expect(audit.before).toEqual(ids)
  })

  it('reordering does not change versions, so open edit forms stay valid', async () => {
    const before = await ctx.prisma.product.findMany({
      where: {serverId: survival, categoryId: ranks},
      orderBy: [{sort: 'asc'}, {slug: 'asc'}]
    })
    const orderUrl = `/api/admin/catalog/servers/${survival}/categories/${ranks}/products/order`
    const base = before.map(p => p.id)
    await editor
      .put(orderUrl)
      .send({ids: [...base].reverse(), base})
      .expect(200)
    const after = await ctx.prisma.product.findMany({
      where: {serverId: survival, categoryId: ranks}
    })
    expect(after.map(p => [p.id, p.version]).sort()).toEqual(
      before.map(p => [p.id, p.version]).sort()
    )
  })
})
