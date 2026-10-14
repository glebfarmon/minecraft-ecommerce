import {Injectable} from '@nestjs/common'

import type {AuditPage, AuditQuery} from '@shop/shared/access'

import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {redact} from './redact'

export type AuditEntryInput = {
  actorId: string | null
  action: string
  entityType?: string
  entityId?: string
  before?: unknown
  after?: unknown
  ip: string
}

const PAGE = 50
const json = (v: unknown) =>
  v === undefined || v === null ? Prisma.DbNull : (redact(v) as Prisma.InputJsonValue)

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(e: AuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: e.actorId,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        before: json(e.before),
        after: json(e.after),
        ip: e.ip
      }
    })
  }

  async page(q: AuditQuery): Promise<AuditPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        actorId: q.actorId,
        action: q.action ? {startsWith: q.action} : undefined,
        createdAt: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined
        }
      },
      include: {actor: {select: {id: true, email: true}}},
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
      take: PAGE + 1,
      ...(q.cursor ? {cursor: {id: q.cursor}, skip: 1} : {})
    })
    const entries = rows.slice(0, PAGE).map(r => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString()
    }))
    return {entries, nextCursor: rows.length > PAGE ? (entries.at(-1)?.id ?? null) : null}
  }
}
