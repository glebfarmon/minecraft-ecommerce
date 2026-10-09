import {ServiceUnavailableException} from '@nestjs/common'

import type {PrismaService} from '../prisma/prisma.service'
import {HealthController} from './health.controller'

const controller = (queryRaw: () => Promise<unknown>) =>
  new HealthController({$queryRaw: queryRaw} as unknown as PrismaService)

describe('HealthController.ready', () => {
  it('reports the database up', async () => {
    await expect(controller(() => Promise.resolve([{ok: 1}])).ready()).resolves.toEqual({
      status: 'ok',
      database: 'up'
    })
  })

  it('returns 503 when the database is down', async () => {
    await expect(
      controller(() => Promise.reject(new Error('ECONNREFUSED'))).ready()
    ).rejects.toThrow(ServiceUnavailableException)
  })
})
