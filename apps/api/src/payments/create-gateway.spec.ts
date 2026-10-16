import {createPaymentsGateway} from './create-gateway'

describe('createPaymentsGateway', () => {
  const stripeEnv = {
    PAYMENTS_GATEWAY: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x'
  }
  it('builds Stripe', () => {
    expect(createPaymentsGateway(stripeEnv).name).toBe('stripe')
  })
  it('defaults to fake outside production', () => {
    expect(createPaymentsGateway({STRIPE_WEBHOOK_SECRET: 'whsec_x'}).name).toBe('fake')
  })
  it('refuses fake in production without the flag', () => {
    expect(() =>
      createPaymentsGateway({
        NODE_ENV: 'production',
        PAYMENTS_GATEWAY: 'fake',
        STRIPE_WEBHOOK_SECRET: 'whsec_x'
      })
    ).toThrow(/PAYMENTS_ALLOW_FAKE/)
  })
  it('allows fake in production with the flag (the e2e image)', () => {
    expect(
      createPaymentsGateway({
        NODE_ENV: 'production',
        PAYMENTS_GATEWAY: 'fake',
        PAYMENTS_ALLOW_FAKE: 'true',
        STRIPE_WEBHOOK_SECRET: 'whsec_x'
      }).name
    ).toBe('fake')
  })
  it('refuses production with no gateway configured', () => {
    expect(() => createPaymentsGateway({NODE_ENV: 'production'})).toThrow(/PAYMENTS_GATEWAY/)
  })
  it('refuses Stripe without keys', () => {
    expect(() => createPaymentsGateway({PAYMENTS_GATEWAY: 'stripe'})).toThrow(/STRIPE_SECRET_KEY/)
  })
  it('refuses an unknown gateway', () => {
    expect(() => createPaymentsGateway({PAYMENTS_GATEWAY: 'paypal'})).toThrow(/PAYMENTS_GATEWAY/)
  })
  it('treats an empty PAYMENTS_GATEWAY as unset outside production', () => {
    expect(createPaymentsGateway({PAYMENTS_GATEWAY: ''}).name).toBe('fake')
  })
  it('treats an empty PAYMENTS_GATEWAY as unset in production', () => {
    expect(() => createPaymentsGateway({NODE_ENV: 'production', PAYMENTS_GATEWAY: ''})).toThrow(
      /PAYMENTS_GATEWAY/
    )
  })
  it('treats an empty STRIPE_SECRET_KEY as missing', () => {
    expect(() =>
      createPaymentsGateway({
        PAYMENTS_GATEWAY: 'stripe',
        STRIPE_SECRET_KEY: '',
        STRIPE_WEBHOOK_SECRET: 'whsec_x'
      })
    ).toThrow(/STRIPE_SECRET_KEY/)
  })
})
