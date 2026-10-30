import {
  cancelUnsentDeliveries,
  restoreOrderDeliveries,
  reverseOrderDeliveries
} from '../src/delivery/delivery-reversal'
import type {DeliveryStatus, Product} from '../src/generated/prisma/client'
import {PrismaService} from '../src/prisma/prisma.service'
import {seedCatalog} from '../src/seed/seed-catalog'
import {startDatabase} from './support/database'

jest.setTimeout(180_000)

const DAY_MS = 86_400_000
const now = new Date('2026-10-30T12:00:00Z')

let db: Awaited<ReturnType<typeof startDatabase>>
let prisma: PrismaService
let permanent: Product
let timed: Product

beforeAll(async () => {
  db = await startDatabase()
  prisma = new PrismaService()
  await seedCatalog(prisma)
  permanent = await prisma.product.findFirstOrThrow({
    where: {kind: 'PERMANENT'},
    orderBy: {id: 'asc'}
  })
  timed = await prisma.product.findFirstOrThrow({where: {kind: 'TIMED'}, orderBy: {id: 'asc'}})
})
afterAll(async () => {
  await prisma.$disconnect()
  await db.stop()
})
beforeEach(async () => {
  await prisma.delivery.deleteMany()
  await prisma.grant.deleteMany()
  await prisma.order.deleteMany()
  permanent = await prisma.product.update({
    where: {id: permanent.id},
    data: {grantCommands: ['give {nick} diamond'], revokeCommands: ['clear {nick} diamond']}
  })
  timed = await prisma.product.update({
    where: {id: timed.id},
    data: {
      durationDays: 7,
      grantCommands: ['lp user {nick} parent add vip'],
      revokeCommands: ['lp user {nick} parent remove vip']
    }
  })
})

let seq = 0
type Line = {
  product: Product
  status?: DeliveryStatus
  commandsDone?: number
  grantId?: string
  quantity?: number
}

/** A PAID order with one item and one GRANT delivery per line, in the given state. */
async function order(lines: Line[], nick = 'Steve') {
  seq += 1
  const created = await prisma.order.create({
    data: {
      publicId: `r${String(Date.now())}${String(seq)}`,
      nick,
      email: 'steve@example.com',
      locale: 'en',
      currency: 'EUR',
      subtotalMinor: 499,
      totalMinor: 499,
      status: 'PAID',
      paidAt: now,
      deliveryConsentAt: now,
      items: {
        create: lines.map(l => ({
          productId: l.product.id,
          serverId: l.product.serverId,
          quantity: l.quantity ?? 1,
          unitAmountMinor: 499,
          productName: l.product.slug,
          serverName: 'srv'
        }))
      }
    },
    include: {items: {orderBy: {id: 'asc'}}}
  })
  const grants: string[] = []
  for (const [i, line] of lines.entries()) {
    const item = created.items[i]
    if (!item) throw new Error('missing item')
    const d = await prisma.delivery.create({
      data: {
        orderItemId: item.id,
        serverId: item.serverId,
        kind: 'GRANT',
        commands: line.product.grantCommands.map(c => c.replaceAll('{nick}', nick)),
        status: line.status ?? 'DONE',
        commandsDone: line.commandsDone ?? (line.status && line.status !== 'DONE' ? 0 : 1),
        ...(line.grantId ? {grantId: line.grantId} : {})
      }
    })
    grants.push(d.id)
  }
  return {order: created, grantDeliveries: grants}
}

const reverse = (orderId: string, cancelUnsent = true) =>
  prisma.$transaction(tx => reverseOrderDeliveries(tx, orderId, now, {cancelUnsent}))
const revokes = (orderId: string) =>
  prisma.delivery.findMany({
    where: {kind: 'REVOKE', orderItem: {orderId}},
    orderBy: {createdAt: 'asc'}
  })

describe('reverseOrderDeliveries', () => {
  it('(a) a DONE non-timed GRANT gets one REVOKE with rendered commands', async () => {
    const {order: o} = await order([{product: permanent}])
    const ids = await reverse(o.id)
    const rows = await revokes(o.id)
    expect(rows).toHaveLength(1)
    expect(ids).toEqual([rows[0]?.id])
    expect(rows[0]).toMatchObject({
      orderItemId: o.items[0]?.id,
      serverId: permanent.serverId,
      grantId: null,
      status: 'PENDING',
      commands: ['clear Steve diamond']
    })
  })

  it('(b) a product without revokeCommands gets no REVOKE', async () => {
    await prisma.product.update({where: {id: permanent.id}, data: {revokeCommands: []}})
    const {order: o} = await order([{product: permanent}])
    expect(await reverse(o.id)).toEqual([])
    expect(await revokes(o.id)).toHaveLength(0)
  })

  it('(c) unsent deliveries are cancelled; the ones that may have sent get a REVOKE', async () => {
    const {order: o, grantDeliveries} = await order([
      {product: permanent, status: 'PENDING'},
      {product: permanent, status: 'FAILED', commandsDone: 0},
      {product: permanent, status: 'FAILED', commandsDone: 2},
      {product: permanent, status: 'NEEDS_REVIEW'}
    ])
    const ids = await reverse(o.id)
    const statuses = await Promise.all(
      grantDeliveries.map(
        async id => (await prisma.delivery.findUniqueOrThrow({where: {id}})).status
      )
    )
    expect(statuses).toEqual(['CANCELLED', 'CANCELLED', 'FAILED', 'NEEDS_REVIEW'])
    const rows = await revokes(o.id)
    expect(ids).toHaveLength(2)
    expect(rows.map(r => r.orderItemId).sort()).toEqual([o.items[2]?.id, o.items[3]?.id].sort())
  })

  it('without cancelUnsent leaves unsent deliveries alone and gives them no REVOKE', async () => {
    const {order: o, grantDeliveries} = await order([{product: permanent, status: 'PENDING'}])
    expect(await reverse(o.id, false)).toEqual([])
    const row = await prisma.delivery.findUniqueOrThrow({where: {id: grantDeliveries[0] ?? ''}})
    expect(row.status).toBe('PENDING')
  })

  it('cancelUnsentDeliveries returns how many it cancelled', async () => {
    const {order: o} = await order([
      {product: permanent, status: 'PENDING'},
      {product: permanent, status: 'FAILED', commandsDone: 0},
      {product: permanent, status: 'DONE'}
    ])
    expect(await prisma.$transaction(tx => cancelUnsentDeliveries(tx, o.id))).toBe(2)
    expect(await prisma.$transaction(tx => cancelUnsentDeliveries(tx, o.id))).toBe(0)
  })

  it('(d) two orders sharing one grant: refunding the first keeps the second one’s time', async () => {
    const grant = await prisma.grant.create({
      data: {
        nick: 'Steve',
        serverId: timed.serverId,
        productId: timed.id,
        expiresAt: new Date(now.getTime() + 14 * DAY_MS)
      }
    })
    const a = await order([{product: timed, grantId: grant.id}])
    const b = await order([{product: timed, grantId: grant.id}])

    expect(await reverse(a.order.id)).toEqual([])
    let row = await prisma.grant.findUniqueOrThrow({where: {id: grant.id}})
    expect(row.expiresAt).toEqual(new Date(now.getTime() + 7 * DAY_MS))
    expect(row.revokedAt).toBeNull()
    expect(await revokes(a.order.id)).toHaveLength(0)

    const ids = await reverse(b.order.id)
    row = await prisma.grant.findUniqueOrThrow({where: {id: grant.id}})
    expect(row.expiresAt).toEqual(now)
    expect(row.revokedAt).toEqual(now)
    const rows = await revokes(b.order.id)
    expect(rows).toHaveLength(1)
    expect(ids).toEqual([rows[0]?.id])
    expect(rows[0]).toMatchObject({
      orderItemId: b.order.items[0]?.id,
      grantId: grant.id,
      serverId: timed.serverId,
      commands: ['lp user Steve parent remove vip']
    })
  })

  it('a timed product without revokeCommands still shrinks and revokes the grant', async () => {
    await prisma.product.update({where: {id: timed.id}, data: {revokeCommands: []}})
    const grant = await prisma.grant.create({
      data: {
        nick: 'Steve',
        serverId: timed.serverId,
        productId: timed.id,
        expiresAt: new Date(now.getTime() + 7 * DAY_MS)
      }
    })
    const {order: o} = await order([{product: timed, grantId: grant.id}])
    expect(await reverse(o.id)).toEqual([])
    const row = await prisma.grant.findUniqueOrThrow({where: {id: grant.id}})
    expect(row.expiresAt).toEqual(now)
    expect(row.revokedAt).toEqual(now)
  })
})

describe('restoreOrderDeliveries', () => {
  it('(e) one RESTORE per reversed item, with the original commands after a catalog edit', async () => {
    await prisma.product.update({where: {id: timed.id}, data: {revokeCommands: []}})
    const grant = await prisma.grant.create({
      data: {
        nick: 'Steve',
        serverId: timed.serverId,
        productId: timed.id,
        expiresAt: new Date(now.getTime() + 14 * DAY_MS)
      }
    })
    const other = await prisma.product.findFirstOrThrow({
      where: {kind: 'PERMANENT', id: {not: permanent.id}},
      orderBy: {id: 'asc'}
    })
    await prisma.product.update({where: {id: other.id}, data: {revokeCommands: []}})
    const {order: o, grantDeliveries} = await order([
      {product: permanent},
      {product: timed, grantId: grant.id},
      {product: other},
      {product: permanent, status: 'PENDING'}
    ])
    await reverse(o.id)
    await prisma.product.update({
      where: {id: permanent.id},
      data: {grantCommands: ['give {nick} dirt']}
    })
    await prisma.product.update({
      where: {id: timed.id},
      data: {grantCommands: ['lp user {nick} parent add mvp']}
    })

    const ids = await prisma.$transaction(tx => restoreOrderDeliveries(tx, o.id))
    const rows = await prisma.delivery.findMany({
      where: {kind: 'RESTORE', orderItem: {orderId: o.id}}
    })
    expect(rows).toHaveLength(2)
    expect(ids.sort()).toEqual(rows.map(r => r.id).sort())
    const grants = await prisma.delivery.findMany({where: {id: {in: grantDeliveries}}})
    const byItem = new Map(rows.map(r => [r.orderItemId, r]))
    expect(byItem.get(o.items[0]?.id ?? '')).toMatchObject({
      kind: 'RESTORE',
      status: 'PENDING',
      serverId: permanent.serverId,
      grantId: null,
      commands: grants.find(g => g.orderItemId === o.items[0]?.id)?.commands
    })
    expect(byItem.get(o.items[0]?.id ?? '')?.commands).toEqual(['give Steve diamond'])
    expect(byItem.get(o.items[1]?.id ?? '')).toMatchObject({
      kind: 'RESTORE',
      grantId: grant.id,
      serverId: timed.serverId,
      commands: ['lp user Steve parent add vip']
    })
  })
})
