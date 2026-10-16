import {Injectable} from '@nestjs/common'

import type {
  AdminServer,
  OrderInput,
  ServerCategoriesInput,
  ServerCreate,
  ServerUpdate
} from '@shop/shared/catalog-admin'

import {badRequest, conflict, inUse, notFound, stale} from '../common/http-errors'
import {PrismaService} from '../prisma/prisma.service'
import {assertSameOrder, assertSameSet, isPrismaError, serializable} from './order'
import {serverInclude, toAdminServer} from './servers.mapper'
import {assertUpdated} from './versioned'

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(withRcon: boolean): Promise<AdminServer[]> {
    const rows = await this.prisma.server.findMany({
      include: serverInclude,
      orderBy: [{sort: 'asc'}, {slug: 'asc'}]
    })
    return rows.map(r => toAdminServer(r, withRcon))
  }

  async get(id: string, withRcon: boolean): Promise<AdminServer> {
    const row = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!row) throw notFound()
    return toAdminServer(row, withRcon)
  }

  /** New servers start disabled and last in the tab order. */
  async create(input: ServerCreate, withRcon: boolean): Promise<AdminServer> {
    const {_max} = await this.prisma.server.aggregate({_max: {sort: true}})
    const row = await this.prisma.server
      .create({
        data: {...input, isActive: false, sort: (_max.sort ?? -1) + 1},
        include: serverInclude
      })
      .catch(slugTaken)
    return toAdminServer(row, withRcon)
  }

  async update(
    id: string,
    input: ServerUpdate,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    // The slug is in storefront URLs and cart cookies (spec decision #9).
    if (current.isActive && input.slug !== current.slug) throw badRequest('slug_locked')
    before(toAdminServer(current, withRcon))
    const {version, ...data} = input
    const {count} = await this.prisma.server
      .updateMany({where: {id, version}, data: {...data, version: {increment: 1}}})
      .catch(slugTaken)
    await assertUpdated(count, async () => (await this.prisma.server.count({where: {id}})) > 0)
    return this.get(id, withRcon)
  }

  async remove(
    id: string,
    version: number,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<void> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    if (current._count.products > 0) throw inUse({products: current._count.products})
    before(toAdminServer(current, withRcon))
    // A product added since the check above makes the foreign key refuse the delete.
    const {count} = await this.prisma.server
      .deleteMany({where: {id, version}})
      .catch((error: unknown) => {
        if (isPrismaError(error, 'P2003')) throw inUse({})
        throw error
      })
    if (count === 0) throw stale()
  }

  /** `before` receives the order being replaced, for the audit row. */
  async order(
    input: OrderInput,
    withRcon: boolean,
    before: (ids: string[]) => void
  ): Promise<AdminServer[]> {
    const {ids, base} = input
    await serializable(this.prisma, async tx => {
      const current = (
        await tx.server.findMany({select: {id: true}, orderBy: [{sort: 'asc'}, {slug: 'asc'}]})
      ).map(s => s.id)
      assertSameSet(current, ids)
      assertSameOrder(current, base)
      before(current)
      for (const [sort, id] of ids.entries()) await tx.server.update({where: {id}, data: {sort}})
    })
    return this.list(withRcon)
  }

  /** Replaces the attached categories and their order; detaching one that still has products is 409. */
  async setCategories(
    id: string,
    input: ServerCategoriesInput,
    withRcon: boolean,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    await serializable(this.prisma, async tx => {
      const current = await tx.server.findUnique({where: {id}, include: serverInclude})
      if (!current) throw notFound()
      assertSameOrder(
        current.categories.map(c => c.category.id),
        input.base
      )
      before(toAdminServer(current, withRcon))
      const known = await tx.category.count({where: {id: {in: input.categoryIds}}})
      if (known !== input.categoryIds.length) throw badRequest('unknown_category')
      const detached = current.categories
        .map(c => c.category.id)
        .filter(cid => !input.categoryIds.includes(cid))
      const products = await tx.product.count({
        where: {serverId: id, categoryId: {in: detached}}
      })
      if (products > 0) throw inUse({products})
      await tx.serverCategory.deleteMany({where: {serverId: id}})
      await tx.serverCategory.createMany({
        data: input.categoryIds.map((categoryId, sort) => ({serverId: id, categoryId, sort}))
      })
    })
    return this.get(id, withRcon)
  }
}
