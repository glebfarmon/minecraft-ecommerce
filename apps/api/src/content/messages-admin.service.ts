import {Injectable, UnprocessableEntityException} from '@nestjs/common'

import {flattenMessages, getMessage, isEditableKey, messageArguments} from '@shop/messages'
import en from '@shop/messages/en.json'
import type {AdminMessage} from '@shop/shared/content'

import {badRequest} from '../common/http-errors'
import {PrismaService} from '../prisma/prisma.service'

type MessageLocale = 'en' | 'pl'
/** What an override or reset replaced, for the audit row. */
export type MessageBefore = {locale: MessageLocale; key: string; value: string | null}

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

/** False when a stored override no longer fits its default (a deploy changed its placeholders or tags). */
export function fitsDefault(locale: MessageLocale, key: string, value: string): boolean {
  try {
    checkOverride(locale, key, value)
    return true
  } catch {
    return false
  }
}

const EDITABLE_KEYS = Object.keys(flattenMessages(en)).filter(isEditableKey).sort()

const toMessage = (locale: MessageLocale, key: string, override: string | null): AdminMessage => ({
  key,
  namespace: key.split('.')[0] ?? key,
  default: getMessage(locale, key) ?? '',
  override,
  stale: override !== null && !fitsDefault(locale, key, override)
})

@Injectable()
export class MessagesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(locale: MessageLocale): Promise<AdminMessage[]> {
    const rows = await this.prisma.messageOverride.findMany({where: {locale}})
    const overrides = new Map(rows.map(r => [r.key, r.value]))
    return EDITABLE_KEYS.map(key => toMessage(locale, key, overrides.get(key) ?? null))
  }

  /** `onBefore` gets the text it replaces (`null` when the default applied), for the audit row. */
  set(
    locale: MessageLocale,
    key: string,
    value: string,
    actorEmail: string,
    onBefore: (before: MessageBefore) => void
  ): Promise<AdminMessage> {
    checkOverride(locale, key, value)
    return this.prisma.$transaction(async tx => {
      const previous = await tx.messageOverride.findUnique({where: {locale_key: {locale, key}}})
      await tx.messageOverride.upsert({
        where: {locale_key: {locale, key}},
        create: {locale, key, value, updatedBy: actorEmail},
        update: {value, updatedBy: actorEmail}
      })
      onBefore({locale, key, value: previous?.value ?? null})
      return toMessage(locale, key, value)
    })
  }

  reset(
    locale: MessageLocale,
    key: string,
    onBefore: (before: MessageBefore) => void
  ): Promise<void> {
    return this.prisma.$transaction(async tx => {
      const previous = await tx.messageOverride.findUnique({where: {locale_key: {locale, key}}})
      await tx.messageOverride.deleteMany({where: {locale, key}})
      onBefore({locale, key, value: previous?.value ?? null})
    })
  }
}
