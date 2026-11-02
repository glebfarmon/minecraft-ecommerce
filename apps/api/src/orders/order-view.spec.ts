import {publicDeliveryState} from '../delivery/delivery-rules'
import type {Order, OrderItem} from '../generated/prisma/client'
import {type OrderWithDeliveries, deliveryStatuses} from './order-view'

const item = (deliveries: OrderWithDeliveries['items'][number]['deliveries']) =>
  ({id: 'i', deliveries}) as unknown as OrderItem & {deliveries: typeof deliveries}
const order = (...items: ReturnType<typeof item>[]) =>
  ({id: 'o', status: 'PAID', items}) as unknown as Order & {items: typeof items}

describe('deliveryStatuses', () => {
  it('ignores REVOKE and CANCELLED rows', () => {
    const o = order(
      item([
        {kind: 'GRANT', status: 'DONE'},
        {kind: 'REVOKE', status: 'FAILED'}
      ]),
      item([
        {kind: 'GRANT', status: 'CANCELLED'},
        {kind: 'RESTORE', status: 'RUNNING'}
      ])
    )
    expect(deliveryStatuses(o)).toEqual([
      {kind: 'GRANT', status: 'DONE'},
      {kind: 'RESTORE', status: 'RUNNING'}
    ])
  })

  it('a stuck REVOKE does not make the buyer state delayed', () => {
    const o = order(
      item([
        {kind: 'GRANT', status: 'DONE'},
        {kind: 'REVOKE', status: 'NEEDS_REVIEW'}
      ])
    )
    expect(
      publicDeliveryState(
        'PAID',
        deliveryStatuses(o).map(d => d.status)
      )
    ).toBe('delivered')
  })
})
