import {Controller, Get, Header, Query} from '@nestjs/common'

import {type CatalogQuery, CatalogQuerySchema, type CatalogResponse} from '@shop/shared/catalog'

import {ValibotPipe} from '../common/valibot.pipe'
import {CatalogService} from './catalog.service'

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  // The web data cache does the real caching (60 s); a shared cache may hold it as long.
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60')
  get(@Query(new ValibotPipe(CatalogQuerySchema)) query: CatalogQuery): Promise<CatalogResponse> {
    return this.catalog.get(query.locale)
  }
}
