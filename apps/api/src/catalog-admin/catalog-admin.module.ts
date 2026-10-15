import {Module} from '@nestjs/common'

import {CategoriesController} from './categories.controller'
import {CategoriesService} from './categories.service'

/** Catalog management for the admin app (sub-project 3b). */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService]
})
export class CatalogAdminModule {}
