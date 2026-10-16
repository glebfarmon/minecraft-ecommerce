import {Injectable} from '@nestjs/common'

import type {AdminSiteSettings} from '@shop/shared/content'

import {assertUpdated} from '../common/versioned'
import {PrismaService} from '../prisma/prisma.service'

type Row = {
  siteNamePlain: string
  siteNameAccent: string
  serverIp: string
  discordUrl: string
  supportEmail: string
  version: number
}

const toSettings = (row: Row): AdminSiteSettings => ({
  siteName: {plain: row.siteNamePlain, accent: row.siteNameAccent},
  serverIp: row.serverIp,
  discordUrl: row.discordUrl,
  supportEmail: row.supportEmail,
  version: row.version
})

@Injectable()
export class SettingsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminSiteSettings> {
    return toSettings(await this.prisma.siteSettings.findUniqueOrThrow({where: {id: 1}}))
  }

  update(
    input: AdminSiteSettings,
    actorEmail: string,
    onBefore: (before: unknown) => void
  ): Promise<AdminSiteSettings> {
    return this.prisma.$transaction(async tx => {
      const {count} = await tx.siteSettings.updateMany({
        where: {id: 1, version: input.version},
        data: {
          siteNamePlain: input.siteName.plain,
          siteNameAccent: input.siteName.accent,
          serverIp: input.serverIp,
          discordUrl: input.discordUrl,
          supportEmail: input.supportEmail,
          version: {increment: 1},
          updatedBy: actorEmail
        }
      })
      await assertUpdated(count, async () => (await tx.siteSettings.count({where: {id: 1}})) > 0)
      onBefore({version: input.version})
      return toSettings(await tx.siteSettings.findUniqueOrThrow({where: {id: 1}}))
    })
  }
}
