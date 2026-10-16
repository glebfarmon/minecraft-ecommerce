import {Injectable} from '@nestjs/common'
import * as v from 'valibot'

import type {RulesDraft, RulesDraftUpdate, RulesVersionList} from '@shop/shared/content'
import {type RulesDocument, RulesDocumentSchema} from '@shop/shared/rules'

import {notFound, stale} from '../common/http-errors'
import {assertUpdated} from '../common/versioned'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'

const PAGE = 20

type DraftRow = {content: Prisma.JsonValue; revision: number; updatedAt: Date; updatedBy: string}

const toDraft = (row: DraftRow): RulesDraft => ({
  content: v.parse(RulesDocumentSchema, row.content),
  revision: row.revision,
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy
})

const json = (doc: RulesDocument) => doc as unknown as Prisma.InputJsonValue

@Injectable()
export class RulesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async draft(): Promise<RulesDraft> {
    const row = await this.prisma.rulesDraft.findUnique({where: {id: 1}})
    if (!row) throw notFound()
    return toDraft(row)
  }

  save(
    input: RulesDraftUpdate,
    actorEmail: string,
    onBefore: (before: unknown) => void
  ): Promise<RulesDraft> {
    return this.prisma.$transaction(async tx => {
      const {count} = await tx.rulesDraft.updateMany({
        where: {id: 1, revision: input.revision},
        data: {content: json(input.content), revision: {increment: 1}, updatedBy: actorEmail}
      })
      await assertUpdated(count, async () => (await tx.rulesDraft.count({where: {id: 1}})) > 0)
      onBefore({revision: input.revision})
      return toDraft(await tx.rulesDraft.findUniqueOrThrow({where: {id: 1}}))
    })
  }

  /** Publishes the draft only if it is still at `revision`, so nobody publishes an edit they never saw. */
  publish(revision: number, actorEmail: string): Promise<{id: number; publishedAt: string}> {
    return this.prisma.$transaction(async tx => {
      // Row lock: a save that lands between this read and the insert waits, so what we publish is
      // exactly the revision the admin looked at.
      const [locked] = await tx.$queryRaw<{revision: number}[]>`
        SELECT revision FROM rules_drafts WHERE id = 1 FOR UPDATE`
      if (!locked) throw notFound()
      if (locked.revision !== revision) throw stale()
      const draft = toDraft(await tx.rulesDraft.findUniqueOrThrow({where: {id: 1}}))
      const row = await tx.rulesVersion.create({
        data: {content: json(draft.content), publishedBy: actorEmail}
      })
      return {id: row.id, publishedAt: row.publishedAt.toISOString()}
    })
  }

  async versions(cursor?: number): Promise<RulesVersionList> {
    const rows = await this.prisma.rulesVersion.findMany({
      where: cursor ? {id: {lt: cursor}} : {},
      orderBy: {id: 'desc'},
      take: PAGE + 1,
      select: {id: true, publishedAt: true, publishedBy: true}
    })
    const page = rows.slice(0, PAGE)
    return {
      versions: page.map(r => ({
        id: r.id,
        publishedAt: r.publishedAt.toISOString(),
        publishedBy: r.publishedBy
      })),
      nextCursor: rows.length > PAGE ? (page[page.length - 1]?.id ?? null) : null
    }
  }

  restore(
    id: number,
    actorEmail: string,
    onBefore: (before: unknown) => void
  ): Promise<RulesDraft> {
    return this.prisma.$transaction(async tx => {
      const version = await tx.rulesVersion.findUnique({where: {id}})
      if (!version) throw notFound()
      const current = await tx.rulesDraft.findUnique({where: {id: 1}})
      if (!current) throw notFound()
      onBefore({revision: current.revision})
      const row = await tx.rulesDraft.update({
        where: {id: 1},
        data: {
          content: version.content as Prisma.InputJsonValue,
          revision: {increment: 1},
          updatedBy: actorEmail
        }
      })
      return toDraft(row)
    })
  }
}
