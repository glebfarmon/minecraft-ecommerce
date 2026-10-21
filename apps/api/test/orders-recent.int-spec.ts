import type {Server} from 'node:http'

import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'
import * as v from 'valibot'

import {RecentPurchasesSchema} from '@shop/shared/orders'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'
import type {OrderStatus} from '../src/generated/prisma/client'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('GET /api/orders/recent', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let app: INestApplication<Server>
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
    prisma = app.get(PrismaService)
    await seedCatalog(prisma)
  })

  afterAll(async () => {
    await app.close()
    await db.stop()
  })

  async function order(n: number, status: OrderStatus, paidAt: Date | null) {
    const product = await prisma.product.findFirstOrThrow({
      where: {slug: 'vip'},
      include: {server: true},
      omit: {icon: true}
    })
    await prisma.order.create({
      data: {
        publicId: `recent-order-${String(n).padStart(9, '0')}`,
        nick: `Buyer_${String(n)}`,
        email: `buyer${String(n)}@example.com`,
        locale: 'en',
        currency: 'EUR',
        subtotalMinor: 1000,
        totalMinor: 2000,
        status,
        deliveryConsentAt: new Date(),
        paidAt,
        items: {
          create: {
            productId: product.id,
            serverId: product.serverId,
            quantity: 2,
            unitAmountMinor: 1000,
            productName: product.slug,
            serverName: product.server.slug
          }
        }
      }
    })
  }

  it('lists paid lines newest first, without private data', async () => {
    const now = Date.now()
    await order(1, 'PAID', new Date(now - 3 * 60_000))
    await order(2, 'DELIVERED', new Date(now - 60_000))
    await order(3, 'PENDING', null)
    await order(4, 'REFUNDED', new Date(now - 2 * 60_000))

    const res = await request(app.getHttpServer()).get('/api/orders/recent').expect(200)
    const {purchases} = v.parse(RecentPurchasesSchema, res.body)

    expect(purchases.map(p => p.nick)).toEqual(['Buyer_2', 'Buyer_1'])
    expect(purchases[0]).toMatchObject({
      server: 'survival',
      product: 'vip',
      currency: 'EUR',
      amountMinor: 2000
    })
    expect(JSON.stringify(res.body)).not.toContain('example.com')
    expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=30')
  })
})
