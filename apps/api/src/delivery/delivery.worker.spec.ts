import {SCHEDULES, schedulesFromEnv} from './delivery.worker'

describe('schedulesFromEnv', () => {
  it('keeps the spec schedules without an override', () => {
    expect(schedulesFromEnv({})).toEqual(SCHEDULES)
    expect(schedulesFromEnv({DELIVERY_ALERT_INTERVAL_MS: ''})).toEqual(SCHEDULES)
  })

  it('takes the alert interval from DELIVERY_ALERT_INTERVAL_MS (e2e)', () => {
    expect(schedulesFromEnv({DELIVERY_ALERT_INTERVAL_MS: '3000'})).toEqual({
      ...SCHEDULES,
      alert: 3000
    })
  })

  it.each(['abc', '1.5', '999', '-1'])('refuses %s', raw => {
    expect(() => schedulesFromEnv({DELIVERY_ALERT_INTERVAL_MS: raw})).toThrow(
      /DELIVERY_ALERT_INTERVAL_MS/
    )
  })
})
