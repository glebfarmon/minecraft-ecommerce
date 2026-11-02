import {Logger} from '@nestjs/common'

import type {DeliveryQueue} from '../src/delivery/delivery-queue'
import {
  cancelUnsentDeliveries,
  restoreOrderDeliveries,
  reverseOrderDeliveries
} from '../src/delivery/delivery-reversal'
import {DeliveryService} from '../src/delivery/delivery.service'
import type {RconSender} from '../src/delivery/rcon-sender'
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
      {product: permanent, status: 'NEEDS_REVIEW'},
      {product: permanent, status: 'PENDING', commandsDone: 1}
    ])
    const ids = await reverse(o.id)
    const statuses = await Promise.all(
      grantDeliveries.map(
        async id => (await prisma.delivery.findUniqueOrThrow({where: {id}})).status
      )
    )
    expect(statuses).toEqual(['CANCELLED', 'CANCELLED', 'FAILED', 'NEEDS_REVIEW', 'CANCELLED'])
    const rows = await revokes(o.id)
    expect(ids).toHaveLength(3)
    expect(rows.map(r => r.orderItemId).sort()).toEqual(
      [o.items[2]?.id, o.items[3]?.id, o.items[4]?.id].sort()
    )
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
    expect(
      (await prisma.delivery.findUniqueOrThrow({where: {id: a.grantDeliveries[0] ?? ''}}))
        .reversedAt
    ).toEqual(now)

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
    // Item 0's REVOKE ran, so it is restored; item 3 was cancelled unsent, so it gets one too.
    await prisma.delivery.updateMany({
      where: {kind: 'REVOKE', orderItem: {orderId: o.id}},
      data: {status: 'DONE'}
    })
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
    expect(rows).toHaveLength(3)
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
    expect(byItem.get(o.items[3]?.id ?? '')?.commands).toEqual(['give Steve diamond'])
    expect(byItem.has(o.items[2]?.id ?? '')).toBe(false)
  })
})

const mkGrant = (expiresAt: Date | null, revokedAt: Date | null = null, nick = 'Steve') =>
  prisma.grant.create({
    data: {nick, serverId: timed.serverId, productId: timed.id, expiresAt, revokedAt}
  })
const grantRow = (id: string) => prisma.grant.findUniqueOrThrow({where: {id}})
const deliveryRow = (id: string | undefined) =>
  prisma.delivery.findUniqueOrThrow({where: {id: id ?? ''}})
const restore = (orderId: string) =>
  prisma.$transaction(tx => restoreOrderDeliveries(tx, orderId, now))

describe('reversal edge cases', () => {
  it('a non-timed item of quantity 3 gets its revoke commands three times', async () => {
    const {order: o, grantDeliveries} = await order([{product: permanent, quantity: 3}])
    await reverse(o.id)
    const rows = await revokes(o.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.commands).toEqual([
      'clear Steve diamond',
      'clear Steve diamond',
      'clear Steve diamond'
    ])
    expect((await deliveryRow(grantDeliveries[0])).reversedAt).toEqual(now)
  })

  it('a timed item of quantity 2 takes back 14 days of a shared grant; the REVOKE runs once', async () => {
    const grant = await mkGrant(new Date(now.getTime() + 21 * DAY_MS))
    const a = await order([{product: timed, grantId: grant.id, quantity: 2}])
    const b = await order([{product: timed, grantId: grant.id}])

    expect(await reverse(a.order.id)).toEqual([])
    expect((await grantRow(grant.id)).expiresAt).toEqual(new Date(now.getTime() + 7 * DAY_MS))
    expect((await deliveryRow(a.grantDeliveries[0])).reversedAt).toEqual(now)

    await reverse(b.order.id)
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: now, revokedAt: now})
    const rows = await revokes(b.order.id)
    expect(rows.map(r => r.commands)).toEqual([['lp user Steve parent remove vip']])
  })

  it('an already revoked grant is not shrunk, gets no REVOKE and is not restored', async () => {
    const past = new Date(now.getTime() - DAY_MS)
    const grant = await mkGrant(past, past)
    const {order: o, grantDeliveries} = await order([{product: timed, grantId: grant.id}])
    expect(await reverse(o.id)).toEqual([])
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: past, revokedAt: past})
    expect((await deliveryRow(grantDeliveries[0])).reversedAt).toBeNull()
    expect(await restore(o.id)).toEqual([])
  })

  it.each(['RUNNING', 'NEEDS_REVIEW'] as const)(
    'a %s timed GRANT on a grant another order holds takes nothing',
    async status => {
      const live = new Date(now.getTime() + 7 * DAY_MS)
      const grant = await mkGrant(live)
      const {order: o, grantDeliveries} = await order([{product: timed, grantId: grant.id, status}])
      expect(await reverse(o.id)).toEqual([])
      expect(await grantRow(grant.id)).toMatchObject({expiresAt: live, revokedAt: null})
      expect((await deliveryRow(grantDeliveries[0])).reversedAt).toBeNull()
    }
  )

  it('a FAILED timed GRANT with commands done on a live grant takes nothing', async () => {
    const live = new Date(now.getTime() + 7 * DAY_MS)
    const grant = await mkGrant(live)
    const {order: o} = await order([
      {product: timed, grantId: grant.id, status: 'FAILED', commandsDone: 1}
    ])
    expect(await reverse(o.id)).toEqual([])
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: live, revokedAt: null})
  })

  it.each([
    ['lapsed', new Date(now.getTime() - DAY_MS)],
    ['never started', null]
  ] as const)('a not-DONE timed GRANT on a %s grant is revoked', async (_, expiresAt) => {
    const grant = await mkGrant(expiresAt)
    const {order: o, grantDeliveries} = await order([
      {product: timed, grantId: grant.id, status: 'FAILED', commandsDone: 1}
    ])
    const ids = await reverse(o.id)
    expect(ids).toHaveLength(1)
    expect(await grantRow(grant.id)).toMatchObject({expiresAt, revokedAt: now})
    expect(await deliveryRow(ids[0])).toMatchObject({
      kind: 'REVOKE',
      grantId: grant.id,
      commands: ['lp user Steve parent remove vip']
    })
    expect((await deliveryRow(grantDeliveries[0])).reversedAt).toEqual(now)
  })

  it('reversing twice creates the REVOKEs once', async () => {
    const {order: o} = await order([{product: permanent}])
    expect(await reverse(o.id)).toHaveLength(1)
    expect(await reverse(o.id)).toEqual([])
    expect(await revokes(o.id)).toHaveLength(1)
  })

  it('a nick that cannot be rendered skips the whole item and logs it', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const live = new Date(now.getTime() + 7 * DAY_MS)
    const grant = await mkGrant(live, null, 'x; op')
    const {order: o, grantDeliveries} = await order([{product: timed, grantId: grant.id}], 'x; op')
    expect(await reverse(o.id)).toEqual([])
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: live, revokedAt: null})
    expect((await deliveryRow(grantDeliveries[0])).reversedAt).toBeNull()
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(grantDeliveries[0] ?? '?'),
      expect.any(Error)
    )
    error.mockRestore()
  })

  it('restoring twice creates the RESTOREs once and clears reversedAt', async () => {
    const {order: o, grantDeliveries} = await order([{product: permanent}])
    await reverse(o.id)
    // The REVOKE ran; one still PENDING would be cancelled instead (see the 5b review cases).
    await prisma.delivery.updateMany({
      where: {kind: 'REVOKE', orderItem: {orderId: o.id}},
      data: {status: 'DONE'}
    })
    expect(await restore(o.id)).toHaveLength(1)
    expect(await restore(o.id)).toEqual([])
    expect((await deliveryRow(grantDeliveries[0])).reversedAt).toBeNull()
    expect(
      await prisma.delivery.count({where: {kind: 'RESTORE', orderItem: {orderId: o.id}}})
    ).toBe(1)
  })
})

describe('restoreOrderDeliveries after 5b review', () => {
  const restores = (orderId: string) =>
    prisma.delivery.findMany({where: {kind: 'RESTORE', orderItem: {orderId}}})
  const unused = {} as RconSender
  const queue: DeliveryQueue = {enqueue: () => Promise.resolve()}
  const complete = (id: string) =>
    prisma.$transaction(tx => new DeliveryService(prisma, unused, queue).complete(tx, id))

  it('a GRANT cancelled unsent is restored, and completing it delivers the order with the clock set', async () => {
    const grant = await mkGrant(null)
    const {order: o, grantDeliveries} = await order([
      {product: timed, grantId: grant.id, status: 'PENDING', quantity: 2}
    ])
    await reverse(o.id)
    expect((await deliveryRow(grantDeliveries[0])).status).toBe('CANCELLED')
    const ids = await restore(o.id)
    expect(ids).toHaveLength(1)
    expect(await deliveryRow(ids[0])).toMatchObject({
      kind: 'RESTORE',
      grantId: grant.id,
      commands: ['lp user Steve parent add vip']
    })
    const before = Date.now()
    await complete(ids[0] ?? '')
    expect(await deliveryRow(ids[0])).toMatchObject({status: 'DONE'})
    expect((await prisma.order.findUniqueOrThrow({where: {id: o.id}})).status).toBe('DELIVERED')
    const row = await grantRow(grant.id)
    expect(row.revokedAt).toBeNull()
    expect(Math.abs((row.expiresAt?.getTime() ?? 0) - (before + 14 * DAY_MS))).toBeLessThan(5_000)
    expect(await restore(o.id)).toEqual([])
  })

  it.each([
    ['PENDING', 0],
    ['FAILED', 0]
  ] as const)(
    'a REVOKE still %s (commandsDone %d) is cancelled and nothing is restored',
    async (status, commandsDone) => {
      const {order: o, grantDeliveries} = await order([{product: permanent}])
      await reverse(o.id)
      const [revoke] = await revokes(o.id)
      await prisma.delivery.update({where: {id: revoke?.id ?? ''}, data: {status, commandsDone}})
      expect(await restore(o.id)).toEqual([])
      expect((await deliveryRow(revoke?.id)).status).toBe('CANCELLED')
      expect((await deliveryRow(grantDeliveries[0])).reversedAt).toBeNull()
      expect(await restores(o.id)).toHaveLength(0)
      expect(await restore(o.id)).toEqual([])
    }
  )

  it.each([
    ['DONE', 1],
    ['FAILED', 1],
    ['PENDING', 1],
    ['RUNNING', 0],
    ['NEEDS_REVIEW', 0]
  ] as const)(
    'a REVOKE %s (commandsDone %d) may have run: the item is restored',
    async (status, commandsDone) => {
      const {order: o} = await order([{product: permanent}])
      await reverse(o.id)
      const [revoke] = await revokes(o.id)
      await prisma.delivery.update({where: {id: revoke?.id ?? ''}, data: {status, commandsDone}})
      const ids = await restore(o.id)
      expect(ids).toHaveLength(1)
      expect((await deliveryRow(revoke?.id)).status).toBe(status)
      expect(await deliveryRow(ids[0])).toMatchObject({
        kind: 'RESTORE',
        commands: ['give Steve diamond']
      })
      expect(await restore(o.id)).toEqual([])
    }
  )

  it('R11 shrunk DONE: a timed item whose REVOKE never ran is renewed instead of restored', async () => {
    const grant = await mkGrant(new Date(now.getTime() + 7 * DAY_MS))
    const {order: o} = await order([{product: timed, grantId: grant.id}])
    await reverse(o.id)
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: now, revokedAt: now})
    const [revoke] = await revokes(o.id)
    expect(await restore(o.id)).toEqual([])
    expect((await deliveryRow(revoke?.id)).status).toBe('CANCELLED')
    expect(await grantRow(grant.id)).toMatchObject({
      expiresAt: new Date(now.getTime() + 7 * DAY_MS),
      revokedAt: null
    })
  })
})

describe('restore and reversal, fix round 1', () => {
  const restores = (orderId: string) =>
    prisma.delivery.findMany({
      where: {kind: 'RESTORE', orderItem: {orderId}},
      orderBy: {createdAt: 'asc'}
    })
  const setStatus = (
    id: string | undefined,
    data: {status: DeliveryStatus; commandsDone?: number}
  ) => prisma.delivery.update({where: {id: id ?? ''}, data})
  const orderStatus = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({where: {id}})).status

  it('R10: a win whose REVOKE never ran restores nothing and still delivers the order', async () => {
    const {order: o} = await order([{product: permanent}])
    await prisma.order.update({where: {id: o.id}, data: {status: 'DISPUTED'}})
    await reverse(o.id)
    await prisma.order.update({where: {id: o.id}, data: {status: 'PAID'}})
    expect(await restore(o.id)).toEqual([])
    expect(await restores(o.id)).toHaveLength(0)
    expect(await orderStatus(o.id)).toBe('DELIVERED')
  })

  it('R11 I2: a GRANT that finished DONE during the dispute is renewed from now at the win', async () => {
    const lapsed = new Date(now.getTime() - DAY_MS)
    const grant = await mkGrant(lapsed)
    const {order: o, grantDeliveries} = await order([
      {product: timed, grantId: grant.id, status: 'RUNNING', quantity: 2}
    ])
    const [revokeId] = await reverse(o.id)
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: lapsed, revokedAt: now})
    // complete() during the dispute marks it DONE without adding time.
    await setStatus(grantDeliveries[0], {status: 'DONE', commandsDone: 1})
    expect(await restore(o.id)).toEqual([])
    expect((await deliveryRow(revokeId)).status).toBe('CANCELLED')
    expect(await grantRow(grant.id)).toMatchObject({
      expiresAt: new Date(now.getTime() + 14 * DAY_MS),
      revokedAt: null
    })
  })

  it('R11 not DONE at the win: only revokedAt is cleared; its own completion adds the time', async () => {
    const lapsed = new Date(now.getTime() - DAY_MS)
    const grant = await mkGrant(lapsed)
    const {order: o} = await order([{product: timed, grantId: grant.id, status: 'NEEDS_REVIEW'}])
    const [revokeId] = await reverse(o.id)
    expect(await restore(o.id)).toEqual([])
    expect((await deliveryRow(revokeId)).status).toBe('CANCELLED')
    expect(await grantRow(grant.id)).toMatchObject({expiresAt: lapsed, revokedAt: null})
    expect(await orderStatus(o.id)).toBe('PAID')
  })

  it('R12: a restored item is taken back once by a later reversal, and restored once again', async () => {
    const {order: o, grantDeliveries} = await order([{product: permanent, status: 'PENDING'}])
    await reverse(o.id)
    const [first] = await restore(o.id)
    expect(first).toBeDefined()
    await setStatus(first, {status: 'DONE', commandsDone: 1})

    const revokeIds = await reverse(o.id)
    expect(revokeIds).toHaveLength(1)
    expect(await revokes(o.id)).toHaveLength(1)
    expect((await deliveryRow(first)).reversedAt).toEqual(now)
    expect(await deliveryRow(grantDeliveries[0])).toMatchObject({
      status: 'CANCELLED',
      reversedAt: null
    })
    expect(await reverse(o.id)).toEqual([])

    await setStatus(revokeIds[0], {status: 'DONE', commandsDone: 1})
    const again = await restore(o.id)
    expect(again).toHaveLength(1)
    expect(await deliveryRow(again[0])).toMatchObject({
      kind: 'RESTORE',
      commands: ['give Steve diamond']
    })
    expect((await deliveryRow(first)).reversedAt).toBeNull()
    expect(await restore(o.id)).toEqual([])
    expect(await restores(o.id)).toHaveLength(2)
  })

  it('R12: a RESTORE that never ran is cancelled by a later reversal and takes nothing twice', async () => {
    const {order: o} = await order([{product: permanent}])
    const [revokeId] = await reverse(o.id)
    await setStatus(revokeId, {status: 'DONE', commandsDone: 1})
    const [restoreId] = await restore(o.id)
    expect(await reverse(o.id)).toEqual([])
    expect((await deliveryRow(restoreId)).status).toBe('CANCELLED')
    expect(await revokes(o.id)).toHaveLength(1)
  })
})
