import * as v from 'valibot'

import {
  DEFAULT_SITE_SETTINGS,
  MessageOverrideInputSchema,
  RulesPublishInputSchema,
  RulesVersionsQuerySchema,
  SiteSettingsSchema,
  SiteSettingsUpdateSchema
} from './content'

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
  it('publishes against the draft revision the admin saw', () => {
    expect(v.safeParse(RulesPublishInputSchema, {revision: 5}).success).toBe(true)
    expect(v.safeParse(RulesPublishInputSchema, {}).success).toBe(false)
    expect(v.safeParse(RulesPublishInputSchema, {revision: -1}).success).toBe(false)
    expect(v.safeParse(RulesPublishInputSchema, {revision: 1.5}).success).toBe(false)
  })
  it('refuses an empty or blank override (reset is the way back to the default)', () => {
    expect(v.safeParse(MessageOverrideInputSchema, {value: ''}).success).toBe(false)
    expect(v.safeParse(MessageOverrideInputSchema, {value: '   '}).success).toBe(false)
    expect(v.parse(MessageOverrideInputSchema, {value: ' Hi '})).toEqual({value: 'Hi'})
  })
  it('caps the versions cursor at the largest int id', () => {
    expect(v.parse(RulesVersionsQuerySchema, {cursor: '2147483647'})).toEqual({
      cursor: 2_147_483_647
    })
    expect(v.safeParse(RulesVersionsQuerySchema, {cursor: '2147483648'}).success).toBe(false)
    expect(v.safeParse(RulesVersionsQuerySchema, {cursor: '9999999999'}).success).toBe(false)
  })
  it('ships valid brand defaults for the seed and the storefront fallback', () => {
    expect(v.parse(SiteSettingsSchema, DEFAULT_SITE_SETTINGS)).toEqual(DEFAULT_SITE_SETTINGS)
    expect(DEFAULT_SITE_SETTINGS).toEqual({
      siteName: {plain: 'Block', accent: 'haus'},
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example'
    })
  })
})
