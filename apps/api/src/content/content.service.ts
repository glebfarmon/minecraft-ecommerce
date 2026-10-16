import {Injectable, InternalServerErrorException, Logger, NotFoundException} from '@nestjs/common'
import * as v from 'valibot'

import {isEditableKey} from '@shop/messages'
import type {Locale} from '@shop/shared/catalog'
import type {SiteSettings} from '@shop/shared/content'
import {type PublicRules, RulesDocumentSchema} from '@shop/shared/rules'

import {PrismaService} from '../prisma/prisma.service'
import {localizeRules} from './localize-rules'

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name)

  constructor(private readonly prisma: PrismaService) {}

  async rules(locale: Locale): Promise<PublicRules> {
    const row = await this.prisma.rulesVersion.findFirst({
      orderBy: [{publishedAt: 'desc'}, {id: 'desc'}]
    })
    if (!row) throw new NotFoundException({statusCode: 404, message: 'not_published'})
    const parsed = v.safeParse(RulesDocumentSchema, row.content)
    if (!parsed.success) {
      this.logger.error(`Stored rules version ${String(row.id)} is malformed`)
      throw new InternalServerErrorException()
    }
    return localizeRules(parsed.output, row.publishedAt, locale)
  }

  async messages(locale: Locale): Promise<Record<string, string>> {
    const rows = await this.prisma.messageOverride.findMany({
      where: {locale},
      orderBy: {key: 'asc'}
    })
    return Object.fromEntries(rows.filter(r => isEditableKey(r.key)).map(r => [r.key, r.value]))
  }

  async settings(): Promise<SiteSettings> {
    const row = await this.prisma.siteSettings.findUnique({where: {id: 1}})
    if (!row) throw new NotFoundException({statusCode: 404, message: 'not_found'})
    return {
      siteName: {plain: row.siteNamePlain, accent: row.siteNameAccent},
      serverIp: row.serverIp,
      discordUrl: row.discordUrl,
      supportEmail: row.supportEmail
    }
  }
}
