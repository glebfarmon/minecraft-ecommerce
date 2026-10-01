import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'

describe('health', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.APP_VERSION = 'test-sha'
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health returns status and deployed version', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body).toEqual({status: 'ok', version: 'test-sha'})
  })

  it('routes without the /api prefix are not served', async () => {
    await request(app.getHttpServer()).get('/health').expect(404)
  })

  it('unknown api route returns JSON 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404)
    expect(res.type).toBe('application/json')
    expect(res.body).toMatchObject({statusCode: 404})
  })
})
