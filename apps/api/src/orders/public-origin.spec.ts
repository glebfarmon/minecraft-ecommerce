import {publicWebOrigin} from './public-origin'

describe('publicWebOrigin', () => {
  it('reads PUBLIC_WEB_ORIGIN', () => {
    expect(publicWebOrigin({PUBLIC_WEB_ORIGIN: 'https://shop.example.com'})).toBe(
      'https://shop.example.com'
    )
  })

  it('falls back to the local origin outside production, an empty value counting as unset', () => {
    expect(publicWebOrigin({})).toBe('http://shop.localhost')
    expect(publicWebOrigin({PUBLIC_WEB_ORIGIN: ''})).toBe('http://shop.localhost')
  })

  it('refuses to start in production without it', () => {
    expect(() => publicWebOrigin({NODE_ENV: 'production'})).toThrow(/PUBLIC_WEB_ORIGIN/)
    expect(() => publicWebOrigin({NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: ''})).toThrow(
      /PUBLIC_WEB_ORIGIN/
    )
  })

  it('strips trailing slashes', () => {
    expect(publicWebOrigin({PUBLIC_WEB_ORIGIN: 'https://x.com/'})).toBe('https://x.com')
    expect(publicWebOrigin({PUBLIC_WEB_ORIGIN: 'https://x.com//'})).toBe('https://x.com')
  })

  it('refuses an unparsable or non-http origin in production', () => {
    for (const bad of ['shop.example.com', 'ftp://x.com', 'not a url'])
      expect(() => publicWebOrigin({NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: bad})).toThrow(
        /PUBLIC_WEB_ORIGIN/
      )
    expect(publicWebOrigin({NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: 'https://x.com/'})).toBe(
      'https://x.com'
    )
  })
})
