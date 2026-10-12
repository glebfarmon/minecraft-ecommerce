import {INestApplication} from '@nestjs/common'
import request from 'supertest'

import {createApp} from '../src/create-app'

describe('status', () => {
  let app: INestApplication

  beforeAll(async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({online: true, players: {online: 42}})
    } as Response)
    app = await createApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    jest.restoreAllMocks()
  })

  it('GET /api/status returns the online flag and player count', async () => {
    const res = await request(app.getHttpServer()).get('/api/status').expect(200)
    expect(res.body).toEqual({online: true, players: 42})
  })
})
