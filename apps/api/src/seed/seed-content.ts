import {DEFAULT_SITE_SETTINGS} from '@shop/shared/content'

import type {Prisma, PrismaClient} from '../generated/prisma/client'
import {DEMO_RULES, DEMO_RULES_PUBLISHED_AT} from './demo-rules'

/** Fixed key of the advisory lock that serialises content seeding across api containers. */
const SEED_CONTENT_LOCK = 3_517_640_221n

/**
 * Settings row and first rules edition; never overwrites admin edits on a re-run. Every api
 * container runs this at start, so it holds a transaction-scoped advisory lock: two containers
 * starting together cannot both create the first edition or race the upserts.
 */
export async function seedContent(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_CONTENT_LOCK})`
    await tx.siteSettings.upsert({
      where: {id: 1},
      update: {},
      create: {
        id: 1,
        siteNamePlain: DEFAULT_SITE_SETTINGS.siteName.plain,
        siteNameAccent: DEFAULT_SITE_SETTINGS.siteName.accent,
        serverIp: DEFAULT_SITE_SETTINGS.serverIp,
        discordUrl: DEFAULT_SITE_SETTINGS.discordUrl,
        supportEmail: DEFAULT_SITE_SETTINGS.supportEmail,
        updatedBy: 'seed'
      }
    })
    const content = DEMO_RULES as unknown as Prisma.InputJsonValue
    await tx.rulesDraft.upsert({
      where: {id: 1},
      update: {},
      create: {id: 1, content, updatedBy: 'seed'}
    })
    if ((await tx.rulesVersion.count()) === 0)
      await tx.rulesVersion.create({
        data: {content, publishedAt: DEMO_RULES_PUBLISHED_AT, publishedBy: 'seed'}
      })
  })
}
