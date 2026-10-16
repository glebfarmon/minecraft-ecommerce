import {Injectable, InternalServerErrorException, Logger, NotFoundException} from '@nestjs/common'
import * as v from 'valibot'

import type {Locale} from '@shop/shared/catalog'
import type {SiteSettings} from '@shop/shared/content'
import {type PublicRules, RulesDocumentSchema} from '@shop/shared/rules'

import {PrismaService} from '../prisma/prisma.service'
import {localizeRules} from './localize-rules'
import {fitsDefault} from './messages-admin.service'

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
    // A deploy can change a default's placeholders or tags under a stored override; serving it
    // would break next-intl on the live site, so the default applies until an admin fixes it.
    const fitting = rows.filter(r => {
      if (fitsDefault(locale, r.key, r.value)) return true
      this.logger.warn(`Dropped stale message override ${locale}:${r.key}`)
      return false
    })
    return Object.fromEntries(fitting.map(r => [r.key, r.value]))
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
