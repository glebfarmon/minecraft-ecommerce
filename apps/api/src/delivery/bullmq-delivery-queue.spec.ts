import {Logger} from '@nestjs/common'

import {BullmqDeliveryQueue, ENQUEUE_TIMEOUT_MS} from './bullmq-delivery-queue'

describe('BullmqDeliveryQueue', () => {
  const savedUrl = process.env.REDIS_URL
  afterEach(() => {
    process.env.REDIS_URL = savedUrl
    jest.restoreAllMocks()
  })

  it('opens no connection until the first enqueue', async () => {
    const queue = new BullmqDeliveryQueue()
    await queue.onApplicationShutdown()
    expect(queue.connected).toBe(false)
  })

  it('enqueue fails within the timeout while Redis is unreachable', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    const queue = new BullmqDeliveryQueue()
    const started = Date.now()
    await expect(queue.enqueue('d1')).rejects.toThrow('enqueue timed out')
    expect(Date.now() - started).toBeLessThan(ENQUEUE_TIMEOUT_MS + 1_000)
    await queue.onApplicationShutdown()
  })
})
