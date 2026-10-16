import {TurnstileVerifier, createTurnstile} from './turnstile'

const reply = (body: unknown, ok = true) =>
  jest.fn().mockResolvedValue({ok, json: () => Promise.resolve(body)})

describe('TurnstileVerifier', () => {
  it('posts secret, token and IP to siteverify and passes on success', async () => {
    const fetchFn = reply({success: true})
    await expect(new TurnstileVerifier('sec', fetchFn).verify('tok', '1.2.3.4')).resolves.toBe(true)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.body as string).toBe(
      new URLSearchParams({secret: 'sec', response: 'tok', remoteip: '1.2.3.4'}).toString()
    )
  })
  it('fails on success:false', async () => {
    await expect(
      new TurnstileVerifier('sec', reply({success: false})).verify('t', 'ip')
    ).resolves.toBe(false)
  })
  it('fails closed when Cloudflare is unreachable', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('down'))
    await expect(new TurnstileVerifier('sec', fetchFn).verify('t', 'ip')).resolves.toBe(false)
  })
  it('fails closed on a non-200', async () => {
    await expect(new TurnstileVerifier('sec', reply({}, false)).verify('t', 'ip')).resolves.toBe(
      false
    )
  })
})

describe('createTurnstile', () => {
  it('refuses production without a secret', () => {
    expect(() => createTurnstile({NODE_ENV: 'production'})).toThrow(/TURNSTILE_SECRET_KEY/)
  })
  it('refuses production with an empty secret', () => {
    expect(() => createTurnstile({NODE_ENV: 'production', TURNSTILE_SECRET_KEY: ''})).toThrow(
      /TURNSTILE_SECRET_KEY/
    )
  })
  it('uses the always-pass test secret locally', () => {
    expect(createTurnstile({})).toBeInstanceOf(TurnstileVerifier)
  })
  it('treats an empty secret outside production as unset', () => {
    expect(createTurnstile({TURNSTILE_SECRET_KEY: ''})).toBeInstanceOf(TurnstileVerifier)
  })
})
