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
})
