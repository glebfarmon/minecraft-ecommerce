import * as v from 'valibot'

import {
  CategoryInputSchema,
  ProductCreateSchema,
  RconInputSchema,
  ServerCreateSchema
} from './catalog-admin'
import {SiteSettingsSchema} from './content'
import {RulesDocumentSchema} from './rules'
import {VALIDATION_MESSAGES, validationKey} from './validation-messages'

const messagesOf = (schema: v.GenericSchema, input: unknown) =>
  v.safeParse(schema, input).issues?.map(issue => issue.message) ?? []

describe('VALIDATION_MESSAGES', () => {
  it('gives every key its own English text, so the reverse map is unambiguous', () => {
    const texts = Object.values(VALIDATION_MESSAGES)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('maps an English message back to its key', () => {
    expect(validationKey('Enter the English text')).toBe('ruleTextRequired')
    expect(validationKey('Only the {nick} placeholder is allowed')).toBe('onlyNickPlaceholder')
    expect(validationKey('Something nobody wrote')).toBeUndefined()
  })
})

describe('shared schemas keep their English messages', () => {
  const rule = (en: string) => ({sections: [{id: 's', title: {en}, items: []}]})

  it.each([
    ['rules: empty English text', RulesDocumentSchema, rule(''), 'Enter the English text'],
    [
      'rules: unsafe link',
      RulesDocumentSchema,
      rule('[x](javascript:alert(1))'),
      'Links must start with https:// or /'
    ],
    [
      'rules: duplicate section ids',
      RulesDocumentSchema,
      {
        sections: [
          {id: 's', title: {en: 'a'}, items: []},
          {id: 's', title: {en: 'b'}, items: []}
        ]
      },
      'Section ids must be unique'
    ],
    [
      'server: bad slug',
      ServerCreateSchema,
      {slug: 'No Good', name: 'x', accent: '#ffffff', onAccent: '#000000'},
      'Use 1–40 lowercase letters, digits or dashes'
    ],
    [
      'server: bad colour',
      ServerCreateSchema,
      {slug: 'ok', name: 'x', accent: 'red', onAccent: '#000000'},
      'Use a hex color like #ff6b1a'
    ],
    [
      'server: empty name',
      ServerCreateSchema,
      {slug: 'ok', name: '', accent: '#ffffff', onAccent: '#000000'},
      'Enter a name'
    ],
    [
      'server: long name',
      ServerCreateSchema,
      {slug: 'ok', name: 'x'.repeat(41), accent: '#ffffff', onAccent: '#000000'},
      'Use at most 40 characters'
    ],
    [
      'category: empty English name',
      CategoryInputSchema,
      {slug: 'ok', names: {en: '', pl: 'x'}},
      'Enter an English name'
    ],
    [
      'category: empty Polish name',
      CategoryInputSchema,
      {slug: 'ok', names: {en: 'x', pl: ''}},
      'Enter a Polish name'
    ],
    [
      'rcon: host without port',
      RconInputSchema,
      {host: 'play.example.com', port: null, password: 'x'},
      'Set host and port together'
    ],
    [
      'settings: bad host',
      SiteSettingsSchema,
      {
        siteName: {plain: 'a', accent: 'b'},
        serverIp: 'no spaces allowed',
        discordUrl: 'https://d.gg/x',
        supportEmail: 'a@b.io'
      },
      'Use a host name or IP, optionally with :port'
    ],
    [
      'settings: http link',
      SiteSettingsSchema,
      {
        siteName: {plain: 'a', accent: 'b'},
        serverIp: 'play.example.com',
        discordUrl: 'http://d.gg/x',
        supportEmail: 'a@b.io'
      },
      'Use an https:// link'
    ]
  ])('%s', (_name, schema, input, message) => {
    expect(messagesOf(schema as v.GenericSchema, input)).toContain(message)
  })

  it('settings: the default valibot texts are replaced by keyed messages', () => {
    const base = {
      siteName: {plain: 'a', accent: 'b'},
      serverIp: 'play.example.com',
      discordUrl: 'https://d.gg/x',
      supportEmail: 'a@b.io'
    }
    const bad = (over: object) => messagesOf(SiteSettingsSchema, {...base, ...over})
    expect(bad({siteName: {plain: '', accent: 'b'}})).toContain('Enter a name')
    expect(bad({siteName: {plain: 'x'.repeat(25), accent: 'b'}})).toContain(
      'Use at most 24 characters'
    )
    expect(bad({discordUrl: 'abc'})).toContain('Enter a valid URL')
    expect(bad({supportEmail: 'nope'})).toContain('Enter a valid email')
  })

  it('product: stray placeholder and long command', () => {
    const base = {
      serverId: 's',
      categoryId: 'c',
      slug: 'p',
      kind: 'PERMANENT',
      mark: 'm',
      isActive: false,
      durationDays: null,
      prices: {EUR: null, PLN: null},
      translations: {en: null, pl: null},
      grantCommands: ['give {player} diamond'],
      revokeCommands: ['x'.repeat(201)]
    }
    const messages = messagesOf(ProductCreateSchema, base)
    expect(messages).toContain('Only the {nick} placeholder is allowed')
    expect(messages).toContain('Use at most 200 characters per command')
  })
})
