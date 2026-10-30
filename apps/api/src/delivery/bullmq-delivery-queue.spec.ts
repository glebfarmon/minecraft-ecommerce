import {Logger} from '@nestjs/common'

import {BullmqDeliveryQueue, ENQUEUE_TIMEOUT_MS} from './bullmq-delivery-queue'

describe('BullmqDeliveryQueue', () => {
  const savedUrl = process.env.REDIS_URL
  afterEach(() => {
    process.env.REDIS_URL = savedUrl
    jest.restoreAllMocks()
  })

  // `createConnection` is protected; the spy needs it as a public key.
  const spyConnection = () =>
    jest.spyOn(
      BullmqDeliveryQueue.prototype as unknown as {createConnection: () => unknown},
      'createConnection'
    )

  it('opens no connection until the first enqueue', async () => {
    const factory = spyConnection()
    const queue = new BullmqDeliveryQueue()
    expect(queue.connected).toBe(false)
    expect(factory).not.toHaveBeenCalled()
    await queue.onApplicationShutdown()
    expect(factory).not.toHaveBeenCalled()
  })

  it('the first enqueue opens the connection; it fails within the timeout while Redis is unreachable', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const factory = spyConnection()
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    const queue = new BullmqDeliveryQueue()
    expect(queue.connected).toBe(false)
    const started = Date.now()
    await expect(queue.enqueue('d1')).rejects.toThrow('enqueue timed out')
    expect(Date.now() - started).toBeLessThan(ENQUEUE_TIMEOUT_MS + 1_000)
    expect(queue.connected).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)
    await queue.onApplicationShutdown()
    expect(queue.connected).toBe(false)
  })
})
