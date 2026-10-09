import {DEFAULT_SITE_SETTINGS} from '@/config/site'

import {getSiteSettings} from './get-site-settings'

describe('getSiteSettings', () => {
  it('returns the defaults until the content API exists', async () => {
    await expect(getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS)
  })

  it('keeps the current brand values', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({
      siteName: {plain: 'Block', accent: 'haus'},
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example'
    })
  })
})
