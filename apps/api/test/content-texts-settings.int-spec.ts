import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

describe('admin texts and settings API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  it('lists allowlisted keys with defaults and sets, reads and resets an override', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const list = (await editor.get('/api/admin/content/messages?locale=pl').expect(200)).body as {
      key: string
      default: string
      override: string | null
    }[]
    expect(list.some(m => m.key === 'cart.title')).toBe(false)
    const title = list.find(m => m.key === 'hero.title')
    expect(title).toMatchObject({override: null, default: expect.any(String) as string})

    await editor
      .put('/api/admin/content/messages/pl/hero.title')
      .send({value: 'Nowy tytuł'})
      .expect(200)
    await request(ctx.app.getHttpServer())
      .get('/api/content/messages?locale=pl')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({'hero.title': 'Nowy tytuł'})
      })
    await editor.delete('/api/admin/content/messages/pl/hero.title').expect(204)
    await editor.delete('/api/admin/content/messages/pl/hero.title').expect(204)
    await request(ctx.app.getHttpServer())
      .get('/api/content/messages?locale=pl')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({})
      })
  })

  it('audits an override and a reset with the key, language and previous text', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const url = '/api/admin/content/messages/en/hero.title'
    await editor.put(url).send({value: 'First'}).expect(200)
    await editor.put(url).send({value: 'Second'}).expect(200)
    await editor.delete(url).expect(204)
    // The interceptor writes audit rows after the response.
    const rows = await waitForRows(3)
    expect(rows.map(r => [r.action, r.entityId, r.before])).toEqual([
      ['message.override', 'en:hero.title', {locale: 'en', key: 'hero.title', value: null}],
      ['message.override', 'en:hero.title', {locale: 'en', key: 'hero.title', value: 'First'}],
      ['message.reset', 'en:hero.title', {locale: 'en', key: 'hero.title', value: 'Second'}]
    ])
  })

  async function waitForRows(n: number) {
    for (let i = 0; i < 50; i += 1) {
      const rows = await ctx.prisma.auditLog.findMany({
        where: {entityType: 'message', entityId: 'en:hero.title'},
        orderBy: {createdAt: 'asc'}
      })
      if (rows.length >= n) return rows
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`expected ${String(n)} audit rows`)
  }

  it('refuses unknown keys and placeholder changes', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    await editor.put('/api/admin/content/messages/en/cart.title').send({value: 'x'}).expect(400)
    await editor
      .put('/api/admin/content/messages/en/rules.title')
      .send({value: 'Rules'})
      .expect(422)
    await editor.put('/api/admin/content/messages/de/hero.title').send({value: 'x'}).expect(400)
    // A blank override would blank a live text; reset is the way back to the default.
    await editor.put('/api/admin/content/messages/en/hero.title').send({value: '  '}).expect(400)
  })

  it('updates settings with the version and refuses a stale one', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const s = (await editor.get('/api/admin/content/settings').expect(200)).body as {
      version: number
      serverIp: string
    }
    const next = {...s, serverIp: 'play.example.com'}
    await editor
      .put('/api/admin/content/settings')
      .send(next)
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({serverIp: 'play.example.com', version: s.version + 1})
      })
    await editor
      .put('/api/admin/content/settings')
      .send({...next, serverIp: 'x.example.com'})
      .expect(409)
    await request(ctx.app.getHttpServer())
      .get('/api/content/settings')
      .expect(200)
      .expect(res => {
        expect(res.body).toMatchObject({serverIp: 'play.example.com'})
      })
  })

  it('needs content.write', async () => {
    const support = await ctx.admin('SUPPORT')
    await support.get('/api/admin/content/settings').expect(403)
    await support.put('/api/admin/content/messages/en/hero.title').send({value: 'x'}).expect(403)
  })
})
