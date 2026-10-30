import * as v from 'valibot'

import {
  AdminDeliverySchema,
  DELIVERY_STATUSES,
  DeliveryStatusSchema,
  PUBLIC_DELIVERY_STATES
} from './delivery'

const valid = {
  id: 'd1',
  kind: 'GRANT',
  status: 'PENDING',
  serverName: 'Survival',
  productName: 'VIP',
  commands: ['give Steve diamond 1'],
  commandsDone: 0,
  attempts: 0,
  nextAttemptAt: '2026-10-30T10:00:00.000Z',
  lastError: null,
  replies: [],
  createdAt: '2026-10-30T10:00:00.000Z'
}

describe('delivery contract', () => {
  it('lists the statuses and public states', () => {
    expect(DELIVERY_STATUSES).toEqual(['PENDING', 'RUNNING', 'DONE', 'FAILED', 'NEEDS_REVIEW'])
    expect(PUBLIC_DELIVERY_STATES).toEqual(['none', 'delivering', 'delayed', 'delivered'])
  })

  it('parses a valid admin delivery', () => {
    expect(v.safeParse(AdminDeliverySchema, valid).success).toBe(true)
    expect(v.safeParse(AdminDeliverySchema, {...valid, productName: null}).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(v.safeParse(AdminDeliverySchema, {...valid, status: 'BROKEN'}).success).toBe(false)
    expect(v.safeParse(DeliveryStatusSchema, 'BROKEN').success).toBe(false)
  })
})
