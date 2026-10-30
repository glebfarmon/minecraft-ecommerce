import {shrinkGrantExpiry} from './delivery-rules'

const DAY = 86_400_000
const expiresAt = new Date('2026-11-13T12:00:00Z')

describe('shrinkGrantExpiry', () => {
  it('takes back exactly durationDays × quantity days', () => {
    expect(shrinkGrantExpiry(expiresAt, 7, 1)).toEqual(new Date(expiresAt.getTime() - 7 * DAY))
    expect(shrinkGrantExpiry(expiresAt, 30, 3)).toEqual(new Date(expiresAt.getTime() - 90 * DAY))
  })

  it('may land in the past', () => {
    expect(shrinkGrantExpiry(expiresAt, 30, 1).getTime()).toBeLessThan(expiresAt.getTime() - DAY)
  })
})
