import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

describe('public content API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })
  const http = () => request(ctx.app.getHttpServer())

  it('serves the published rules in Polish without a session', async () => {
    const res = await http().get('/api/content/rules?locale=pl').expect(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toMatchObject({publishedAt: '2026-05-28T12:00:00.000Z'})
    expect((res.body as {sections: unknown[]}).sections.length).toBeGreaterThan(0)
  })

  it('refuses an unknown locale', async () => {
    await http().get('/api/content/rules?locale=de').expect(400)
  })

  it('answers 404 not_published before the first publish', async () => {
    await ctx.prisma.rulesVersion.deleteMany()
    await http()
      .get('/api/content/rules?locale=en')
      .expect(404)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'not_published'})
      })
  })

  it('serves overrides as flat keys and the settings row', async () => {
    await ctx.prisma.messageOverride.create({
      data: {locale: 'en', key: 'hero.title', value: 'Hi', updatedBy: 'test'}
    })
    await http()
      .get('/api/content/messages?locale=en')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({'hero.title': 'Hi'})
      })
    await http()
      .get('/api/content/settings')
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({
          siteName: {plain: 'Block', accent: 'haus'},
          serverIp: 'mc.mineblaze.net',
          discordUrl: 'https://discord.com',
          supportEmail: 'support@blockhaus.example'
        })
      })
  })
})
