import {Logger} from '@nestjs/common'

import {ContentService} from './content.service'
import {MessagesAdminService} from './messages-admin.service'

// `rules.title` has an `<accent>` tag in the file default: an override without it was saved
// against an older default and would break next-intl on the live site.
const rows = [
  {locale: 'en', key: 'hero.title', value: 'Hello'},
  {locale: 'en', key: 'rules.title', value: 'Our rules'}
]
const prisma = {messageOverride: {findMany: jest.fn(() => Promise.resolve(rows))}} as never

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ContentService.messages', () => {
  it('drops an override that no longer matches its default and logs the key once', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    await expect(new ContentService(prisma).messages('en')).resolves.toEqual({
      'hero.title': 'Hello'
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('en:rules.title')
  })
})

describe('MessagesAdminService.list', () => {
  it('marks a stored override that no longer matches its default as stale', async () => {
    const list = await new MessagesAdminService(prisma).list('en')
    expect(list.find(m => m.key === 'rules.title')).toMatchObject({
      override: 'Our rules',
      stale: true
    })
    expect(list.find(m => m.key === 'hero.title')).toMatchObject({override: 'Hello', stale: false})
    expect(list.find(m => m.override === null)).toMatchObject({stale: false})
  })
})
