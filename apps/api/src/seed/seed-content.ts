import type {Prisma, PrismaClient} from '../generated/prisma/client'
import {DEMO_RULES, DEMO_RULES_PUBLISHED_AT} from './demo-rules'

/** Settings row and first rules edition; never overwrites admin edits on a re-run. */
export async function seedContent(prisma: PrismaClient): Promise<void> {
  await prisma.siteSettings.upsert({
    where: {id: 1},
    update: {},
    create: {
      id: 1,
      siteNamePlain: 'Block',
      siteNameAccent: 'haus',
      serverIp: 'mc.mineblaze.net',
      discordUrl: 'https://discord.com',
      supportEmail: 'support@blockhaus.example',
      updatedBy: 'seed'
    }
  })
  const content = DEMO_RULES as unknown as Prisma.InputJsonValue
  await prisma.rulesDraft.upsert({
    where: {id: 1},
    update: {},
    create: {id: 1, content, updatedBy: 'seed'}
  })
  if ((await prisma.rulesVersion.count()) === 0)
    await prisma.rulesVersion.create({
      data: {content, publishedAt: DEMO_RULES_PUBLISHED_AT, publishedBy: 'seed'}
    })
}
