import type {AdminServer} from '@shop/shared/catalog-admin'

import type {Prisma} from '../generated/prisma/client'

export const serverInclude = {
  categories: {
    orderBy: {sort: 'asc'},
    select: {
      category: {
        select: {id: true, slug: true, translations: {where: {locale: 'en'}, select: {name: true}}}
      }
    }
  },
  _count: {select: {products: true}}
} satisfies Prisma.ServerInclude
export type ServerRow = Prisma.ServerGetPayload<{include: typeof serverInclude}>

/** `withRcon` only for viewers holding `server.rcon`; the password itself never leaves the API. */
export const toAdminServer = (r: ServerRow, withRcon: boolean): AdminServer => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  accent: r.accent,
  onAccent: r.onAccent,
  isActive: r.isActive,
  sort: r.sort,
  version: r.version,
  productCount: r._count.products,
  categories: r.categories.map(({category: c}) => ({
    id: c.id,
    slug: c.slug,
    name: c.translations[0]?.name ?? c.slug
  })),
  rcon: withRcon ? {host: r.rconHost, port: r.rconPort} : null,
  rconPasswordSet: r.rconPasswordEnc !== null
})
