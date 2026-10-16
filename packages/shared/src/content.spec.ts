import * as v from 'valibot'

import {MessageOverrideInputSchema, SiteSettingsUpdateSchema} from './content'

const settings = {
  siteName: {plain: 'Block', accent: 'haus'},
  serverIp: 'mc.mineblaze.net',
  discordUrl: 'https://discord.gg/abc',
  supportEmail: 'support@blockhaus.example',
  version: 1
}

describe('content schemas', () => {
  it('accepts valid settings', () => {
    expect(v.safeParse(SiteSettingsUpdateSchema, settings).success).toBe(true)
    expect(
      v.safeParse(SiteSettingsUpdateSchema, {...settings, serverIp: '95.217.1.1:25565'}).success
    ).toBe(true)
  })
  it.each([
    {serverIp: 'not a host!'},
    {discordUrl: 'http://discord.gg/abc'},
    {supportEmail: 'nope'},
    {siteName: {plain: '', accent: 'haus'}},
    {siteName: {plain: 'x'.repeat(25), accent: 'haus'}}
  ])('refuses %p', patch => {
    expect(v.safeParse(SiteSettingsUpdateSchema, {...settings, ...patch}).success).toBe(false)
  })
  it('caps an override at 2000 characters', () => {
    expect(v.safeParse(MessageOverrideInputSchema, {value: 'x'.repeat(2001)}).success).toBe(false)
  })
})
