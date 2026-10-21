import {getSiteName, getSiteTitle} from './site-name'

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
})

describe('getSiteName', () => {
  it('returns the name from the settings response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({siteName: {plain: 'Craft', accent: 'Land'}})
    })
    expect(await getSiteName()).toEqual({plain: 'Craft', accent: 'Land'})
    expect(await getSiteTitle()).toBe('CraftLand')
  })

  it('falls back to the default when the API answers with an error', async () => {
    fetchMock.mockResolvedValue({ok: false})
    expect(await getSiteTitle()).toBe('Blockhaus')
  })

  it('falls back to the default when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    expect(await getSiteTitle()).toBe('Blockhaus')
  })
})
