import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'

describe('status', () => {
  let app: INestApplication

  beforeAll(async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({online: true, players: {online: 42}})
    } as Response)
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
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
