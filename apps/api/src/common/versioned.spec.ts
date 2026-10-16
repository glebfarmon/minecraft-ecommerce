import {assertUpdated} from './versioned'

describe('assertUpdated', () => {
  it('passes when one row changed', async () => {
    await expect(assertUpdated(1, () => Promise.resolve(true))).resolves.toBeUndefined()
  })

  it('is 409 stale when the row exists with another version', async () => {
    await expect(assertUpdated(0, () => Promise.resolve(true))).rejects.toMatchObject({
      status: 409,
      response: {message: 'stale'}
    })
  })

  it('is 404 when the row is gone', async () => {
    await expect(assertUpdated(0, () => Promise.resolve(false))).rejects.toMatchObject({
      status: 404
    })
  })
})
