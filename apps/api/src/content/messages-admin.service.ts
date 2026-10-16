import {Injectable, UnprocessableEntityException} from '@nestjs/common'

import {flattenMessages, getMessage, isEditableKey, messageArguments} from '@shop/messages'
import en from '@shop/messages/en.json'
import type {AdminMessage} from '@shop/shared/content'

import {badRequest} from '../common/http-errors'
import {PrismaService} from '../prisma/prisma.service'

type MessageLocale = 'en' | 'pl'

const mismatch = (expected: string[], found: string[]) =>
  new UnprocessableEntityException({
    statusCode: 422,
    message: 'placeholder_mismatch',
    issues: {expected, found}
  })

/** Allowlisted key, same ICU arguments and tags as the file default (spec §5). */
export function checkOverride(locale: MessageLocale, key: string, value: string): void {
  const fallback = getMessage(locale, key)
  if (!isEditableKey(key) || fallback === undefined) throw badRequest('unknown_key')
  const expected = messageArguments(fallback)
  let found: string[]
  try {
    found = messageArguments(value)
  } catch {
    throw mismatch(expected, [])
  }
  if (expected.join('\n') !== found.join('\n')) throw mismatch(expected, found)
}

const EDITABLE_KEYS = Object.keys(flattenMessages(en)).filter(isEditableKey).sort()

const toMessage = (locale: MessageLocale, key: string, override: string | null): AdminMessage => ({
  key,
  namespace: key.split('.')[0] ?? key,
  default: getMessage(locale, key) ?? '',
  override
})

@Injectable()
export class MessagesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(locale: MessageLocale): Promise<AdminMessage[]> {
    const rows = await this.prisma.messageOverride.findMany({where: {locale}})
    const overrides = new Map(rows.map(r => [r.key, r.value]))
    return EDITABLE_KEYS.map(key => toMessage(locale, key, overrides.get(key) ?? null))
  }

  async set(
    locale: MessageLocale,
    key: string,
    value: string,
    actorEmail: string
  ): Promise<AdminMessage> {
    checkOverride(locale, key, value)
    await this.prisma.messageOverride.upsert({
      where: {locale_key: {locale, key}},
      create: {locale, key, value, updatedBy: actorEmail},
      update: {value, updatedBy: actorEmail}
    })
    return toMessage(locale, key, value)
  }

  async reset(locale: MessageLocale, key: string): Promise<void> {
    await this.prisma.messageOverride.deleteMany({where: {locale, key}})
  }
}
