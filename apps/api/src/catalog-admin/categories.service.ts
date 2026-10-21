import {Injectable} from '@nestjs/common'

import {LOCALES} from '@shop/shared/catalog'
import type {AdminCategory, CategoryInput, CategoryUpdate} from '@shop/shared/catalog-admin'

import {conflict, inUse, notFound, stale} from '../common/http-errors'
import {assertUpdated} from '../common/versioned'
import type {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {isPrismaError} from './order'

const include = {
  translations: true,
  servers: {select: {server: {select: {id: true, name: true}}}},
  _count: {select: {products: true}}
} satisfies Prisma.CategoryInclude
type Row = Prisma.CategoryGetPayload<{include: typeof include}>

const toAdminCategory = (r: Row): AdminCategory => ({
  id: r.id,
  slug: r.slug,
  icon: r.icon,
  version: r.version,
  names: {
    en: r.translations.find(t => t.locale === 'en')?.name ?? r.slug,
    pl: r.translations.find(t => t.locale === 'pl')?.name ?? r.slug
  },
  productCount: r._count.products,
  servers: r.servers.map(s => s.server)
})

const slugTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('slug_taken')
  throw error
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({include, orderBy: {slug: 'asc'}})
    return rows.map(toAdminCategory)
  }

  async create(input: CategoryInput): Promise<AdminCategory> {
    const row = await this.prisma.category
      .create({
        data: {
          slug: input.slug,
          icon: input.icon,
          translations: {create: LOCALES.map(locale => ({locale, name: input.names[locale]}))}
        },
        include
      })
      .catch(slugTaken)
    return toAdminCategory(row)
  }

  async update(
    id: string,
    input: CategoryUpdate,
    before: (c: AdminCategory) => void
  ): Promise<AdminCategory> {
    const current = await this.prisma.category.findUnique({where: {id}, include})
    if (!current) throw notFound()
    before(toAdminCategory(current))
    const row = await this.prisma
      .$transaction(async tx => {
        const {count} = await tx.category.updateMany({
          where: {id, version: input.version},
          data: {slug: input.slug, icon: input.icon, version: {increment: 1}}
        })
        await assertUpdated(count, async () => (await tx.category.count({where: {id}})) > 0)
        for (const locale of LOCALES)
          await tx.categoryTranslation.upsert({
            where: {categoryId_locale: {categoryId: id, locale}},
            create: {categoryId: id, locale, name: input.names[locale]},
            update: {name: input.names[locale]}
          })
        return tx.category.findUniqueOrThrow({where: {id}, include})
      })
      .catch(slugTaken)
    return toAdminCategory(row)
  }

  async remove(id: string, version: number, before: (c: AdminCategory) => void): Promise<void> {
    const current = await this.prisma.category.findUnique({where: {id}, include})
    if (!current) throw notFound()
    const counts = {products: current._count.products, servers: current.servers.length}
    if (counts.products > 0 || counts.servers > 0) throw inUse(counts)
    before(toAdminCategory(current))
    // A product or server link added since the check above makes the foreign key refuse the delete.
    const {count} = await this.prisma.category
      .deleteMany({where: {id, version}})
      .catch((error: unknown) => {
        if (isPrismaError(error, 'P2003')) throw inUse({})
        throw error
      })
    if (count === 0) throw stale()
  }
}
