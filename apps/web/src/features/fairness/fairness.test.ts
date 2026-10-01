/** @jest-environment node */
import {createHash, createHmac} from 'node:crypto'

import {roll, sha256Hex} from './fairness'

const prizes = [
  {id: 2, name: 'b', weight: 300},
  {id: 1, name: 'a', weight: 600},
  {id: 3, name: 'c', weight: 100}
]

describe('provably fair roll', () => {
  it('matches an independent Node computation of the spec §10.2 algorithm', async () => {
    for (const nonce of [0, 1, 2, 3, 42, 999]) {
      const hmac = createHmac('sha256', 'server-seed')
        .update(`client-seed:${String(nonce)}`)
        .digest('hex')
      const x = parseInt(hmac.slice(0, 13), 16)
      const expectedRoll = Math.floor((x / 2 ** 52) * 1000)
      const expectedId = expectedRoll < 600 ? 1 : expectedRoll < 900 ? 2 : 3

      const result = await roll('server-seed', 'client-seed', nonce, prizes)

      expect(result.hmac).toBe(hmac)
      expect(result.roll).toBe(expectedRoll)
      expect(result.prize.id).toBe(expectedId)
    }
  })

  it('hashes the server seed with SHA-256', async () => {
    expect(await sha256Hex('server-seed')).toBe(
      createHash('sha256').update('server-seed').digest('hex')
    )
  })
})
