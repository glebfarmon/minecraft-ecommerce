import type {Server} from 'node:http'

import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'
import * as v from 'valibot'

import {CatalogResponseSchema} from '@shop/shared/catalog'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('GET /api/catalog', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication<Server>

  beforeAll(async () => {
    db = await startDatabase()
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
    await seedCatalog(app.get(PrismaService))
  })

  afterAll(async () => {
    await app.close()
    await db.stop()
  })

  it('returns the seeded catalog in Polish', async () => {
    const res = await request(app.getHttpServer()).get('/api/catalog?locale=pl').expect(200)
    const body = v.parse(CatalogResponseSchema, res.body)
    expect(body.servers.map(s => s.slug)).toEqual(['survival', 'anarchy', 'minigames'])
    expect(body.servers[1]?.categories.map(c => c.slug)).toEqual([
      'kits',
      'ranks',
      'cases',
      'currency'
    ])
    expect(body.servers[0]?.categories[0]?.name).toBe('Rangi')
    expect(body.products).toHaveLength(20)
    expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=60')
  })

  it('leaves out inactive products and products of inactive servers', async () => {
    const prisma = app.get(PrismaService)
    await prisma.product.updateMany({where: {slug: 'vip'}, data: {isActive: false}})
    await prisma.server.update({where: {slug: 'minigames'}, data: {isActive: false}})
    const res = await request(app.getHttpServer()).get('/api/catalog?locale=en').expect(200)
    const body = v.parse(CatalogResponseSchema, res.body)
    expect(body.products.some(p => p.slug === 'vip')).toBe(false)
    expect(body.products.some(p => p.server === 'minigames')).toBe(false)
    expect(body.servers.map(s => s.slug)).toEqual(['survival', 'anarchy'])
  })

  it.each(['', '?locale=PL', '?locale=de', '?locale=en&locale=pl'])(
    'returns 400 for "%s"',
    async query => {
      await request(app.getHttpServer()).get(`/api/catalog${query}`).expect(400)
    }
  )
})
