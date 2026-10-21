import nextConfig from '../../next.config'
import robots from './robots'

// The plugin resolves its own files from disk, which the jsdom environment cannot do; the wrapper is not under test.
jest.mock('next-intl/plugin', () => ({
  __esModule: true,
  default: () => (config: unknown) => config
}))

describe('admin indexing', () => {
  it('serves a robots.txt that disallows everything', () => {
    expect(robots()).toEqual({rules: {userAgent: '*', disallow: '/'}})
  })

  it('sends X-Robots-Tag: noindex, nofollow on every path', async () => {
    const rules = (await nextConfig.headers?.()) ?? []
    expect(rules).toContainEqual({
      source: '/:path*',
      headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}]
    })
  })
})
