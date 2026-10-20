import {Injectable, Logger} from '@nestjs/common'

import type {CatalogResponse, Locale} from '@shop/shared/catalog'

import {PrismaService} from '../prisma/prisma.service'
import {toCatalogResponse} from './catalog.mapper'

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name)

  constructor(private readonly prisma: PrismaService) {}

  async get(locale: Locale): Promise<CatalogResponse> {
    const texts = {where: {locale: {in: [locale, 'en' as const]}}}
    const [servers, products] = await Promise.all([
      this.prisma.server.findMany({
        where: {isActive: true},
        orderBy: [{sort: 'asc'}, {slug: 'asc'}],
        select: {
          slug: true,
          name: true,
          accent: true,
          onAccent: true,
          rconHost: true,
          rconPort: true,
          rconPasswordEnc: true,
          categories: {
            orderBy: {sort: 'asc'},
            select: {
              category: {
                select: {slug: true, translations: {...texts, select: {locale: true, name: true}}}
              }
            }
          }
        }
      }),
      this.prisma.product.findMany({
        where: {isActive: true, server: {isActive: true}},
        orderBy: [{sort: 'asc'}, {slug: 'asc'}],
        select: {
          slug: true,
          kind: true,
          durationDays: true,
          mark: true,
          icon: true,
          server: {select: {slug: true}},
          category: {select: {slug: true}},
          translations: {
            ...texts,
            select: {locale: true, name: true, description: true, sections: true}
          },
          prices: {select: {currency: true, amountMinor: true}}
        }
      })
    ])
    return toCatalogResponse({servers, products}, locale, message => {
      this.logger.warn(message)
    })
  }
}
