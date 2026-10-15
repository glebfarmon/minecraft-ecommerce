import {randomBytes} from 'node:crypto'

import {startCatalogApp} from './support/catalog-app'
import {startFakeRcon} from './support/fake-rcon'

jest.setTimeout(180_000)

describe('catalog RCON API', () => {
  let ctx: Awaited<ReturnType<typeof startCatalogApp>>
  let fake: Awaited<ReturnType<typeof startFakeRcon>>
  let serverId = ''

  beforeAll(async () => {
    process.env.RCON_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
    fake = await startFakeRcon('secret')
    ctx = await startCatalogApp()
    serverId = (await ctx.prisma.server.findUniqueOrThrow({where: {slug: 'survival'}})).id
  })
  afterAll(async () => {
    await ctx.stop()
    await fake.stop()
  })

  const url = () => `/api/admin/catalog/servers/${serverId}/rcon`

  it('needs server.rcon, even with catalog.write', async () => {
    const editor = await ctx.admin({permissions: ['catalog.write']})
    await editor.put(url()).send({host: '127.0.0.1', port: fake.port}).expect(403)
    await editor.post(`${url()}/test`).expect(403)
  })

  it('stores the password encrypted, reports it as set and keeps it out of the audit log', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
      .expect(200)
    expect(res.body).toMatchObject({
      rcon: {host: '127.0.0.1', port: fake.port},
      rconPasswordSet: true
    })
    expect(JSON.stringify(res.body)).not.toContain('secret')
    const row = await ctx.prisma.server.findUniqueOrThrow({where: {id: serverId}})
    expect(row.rconPasswordEnc).toMatch(/^v1:/)
    const audit = await ctx.prisma.auditLog.findMany({where: {entityId: serverId}})
    expect(JSON.stringify(audit)).not.toContain('secret')
    expect(JSON.stringify(audit)).not.toContain(row.rconPasswordEnc ?? 'never')
  })

  it('tests the connection against the stored target', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator.post(`${url()}/test`).expect(200)
    expect(res.body).toEqual({ok: true, ms: expect.any(Number) as number})
  })

  it('refuses an internal host when private hosts are not allowed', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    process.env.RCON_ALLOW_PRIVATE_HOSTS = 'false'
    try {
      for (const host of ['127.0.0.1', '10.0.0.5', 'localhost'])
        await operator
          .put(url())
          .send({host, port: 25575})
          .expect(400)
          .expect(res => {
            expect(res.body).toMatchObject({message: 'rcon_host_private'})
          })
      await operator
        .post(`${url()}/test`)
        .expect(400)
        .expect(res => {
          expect(res.body).toMatchObject({message: 'rcon_host_private'})
        })
    } finally {
      process.env.RCON_ALLOW_PRIVATE_HOSTS = 'true'
    }
  })

  it('clears the password', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const res = await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, clearPassword: true})
      .expect(200)
    expect(res.body).toMatchObject({rconPasswordSet: false})
    await operator
      .post(`${url()}/test`)
      .expect(400)
      .expect(r => {
        expect(r.body).toMatchObject({message: 'rcon_not_configured'})
      })
  })

  it('answers 503 rcon_key_missing without a key', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    const saved = process.env.RCON_ENCRYPTION_KEY
    delete process.env.RCON_ENCRYPTION_KEY
    try {
      await operator
        .put(url())
        .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
        .expect(503)
        .expect(res => {
          expect(res.body).toMatchObject({message: 'rcon_key_missing'})
        })
    } finally {
      process.env.RCON_ENCRYPTION_KEY = saved
    }
  })

  it('allows 5 tests per minute per session', async () => {
    const operator = await ctx.admin({permissions: ['server.rcon']})
    await operator
      .put(url())
      .send({host: '127.0.0.1', port: fake.port, password: 'secret'})
      .expect(200)
    for (let i = 0; i < 5; i++) await operator.post(`${url()}/test`).expect(200)
    await operator.post(`${url()}/test`).expect(429)
  })
})
