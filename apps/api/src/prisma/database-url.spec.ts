import {poolConfig} from './database-url'

const original = process.env.DATABASE_URL

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = original
})

describe('poolConfig', () => {
  it('uses DATABASE_URL and a 5 s connect timeout', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db:5432/x'
    expect(poolConfig()).toEqual({
      connectionString: 'postgresql://u:p@db:5432/x',
      connectionTimeoutMillis: 5000
    })
  })

  it('falls back to the local compose database', () => {
    delete process.env.DATABASE_URL
    expect(poolConfig().connectionString).toBe('postgresql://shop:shop@localhost:5432/shop')
  })
})
