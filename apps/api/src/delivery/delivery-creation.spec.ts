import type {Prisma} from '../generated/prisma/client'
import type {OrderWithItems} from '../orders/order-view'
import {createDeliveriesForPaidOrder} from './delivery-creation'

type Product = {id: string; kind: 'PERMANENT' | 'TIMED' | 'CASE'; grantCommands: string[]}

function setup(products: Product[], nick = 'Steve_1') {
  const created: Record<string, unknown>[] = []
  const upserts: Record<string, unknown>[] = []
  const tx = {
    product: {findMany: jest.fn().mockResolvedValue(products)},
    grant: {
      upsert: jest.fn().mockImplementation((args: Record<string, unknown>) => {
        upserts.push(args)
        return Promise.resolve({id: 'grant_1'})
      })
    },
    delivery: {
      create: jest.fn().mockImplementation(({data}: {data: Record<string, unknown>}) => {
        created.push(data)
        return Promise.resolve({id: `d${String(created.length)}`})
      })
    }
  }
  const item = (id: string, productId: string, quantity: number) => ({
    id,
    productId,
    serverId: 'srv1',
    quantity
  })
  const order = {
    id: 'o1',
    nick,
    items: products.map((p, i) => item(`i${String(i)}`, p.id, 2))
  } as unknown as OrderWithItems
  return {tx: tx as unknown as Prisma.TransactionClient, raw: tx, order, created, upserts}
}

describe('createDeliveriesForPaidOrder', () => {
  it('PERMANENT item creates one GRANT delivery with rendered commands repeated quantity times', async () => {
    const s = setup([{id: 'p1', kind: 'PERMANENT', grantCommands: ['give {nick} 1']}])
    const ids = await createDeliveriesForPaidOrder(s.tx, s.order)
    expect(ids).toEqual(['d1'])
    expect(s.created).toEqual([
      {
        orderItemId: 'i0',
        serverId: 'srv1',
        kind: 'GRANT',
        commands: ['give Steve_1 1', 'give Steve_1 1']
      }
    ])
    expect(s.raw.grant.upsert).not.toHaveBeenCalled()
    expect(s.raw.product.findMany).toHaveBeenCalledTimes(1)
  })

  it('TIMED item creates a grant without expiresAt and links it', async () => {
    const s = setup([{id: 'p1', kind: 'TIMED', grantCommands: ['lp {nick}']}])
    await createDeliveriesForPaidOrder(s.tx, s.order)
    expect(s.upserts).toEqual([
      {
        where: {nick_serverId_productId: {nick: 'Steve_1', serverId: 'srv1', productId: 'p1'}},
        create: {nick: 'Steve_1', serverId: 'srv1', productId: 'p1'},
        update: {}
      }
    ])
    expect(s.created[0]).toMatchObject({grantId: 'grant_1', kind: 'GRANT'})
  })

  it('CASE item creates nothing', async () => {
    const s = setup([{id: 'p1', kind: 'CASE', grantCommands: ['x']}])
    expect(await createDeliveriesForPaidOrder(s.tx, s.order)).toEqual([])
    expect(s.raw.delivery.create).not.toHaveBeenCalled()
  })

  it('an invalid nick creates a NEEDS_REVIEW delivery with no commands instead of throwing', async () => {
    const s = setup([{id: 'p1', kind: 'PERMANENT', grantCommands: ['give {nick}']}], 'bad nick!')
    await createDeliveriesForPaidOrder(s.tx, s.order)
    expect(s.created).toEqual([
      {
        orderItemId: 'i0',
        serverId: 'srv1',
        kind: 'GRANT',
        commands: [],
        status: 'NEEDS_REVIEW',
        lastError: 'invalid_nick'
      }
    ])
    expect(s.raw.grant.upsert).not.toHaveBeenCalled()
  })
})
