import {Module} from '@nestjs/common'

import {CategoriesController} from './categories.controller'
import {CategoriesService} from './categories.service'
import {ServersController} from './servers.controller'
import {ServersService} from './servers.service'

/** Catalog management for the admin app (sub-project 3b). */
@Module({
  controllers: [CategoriesController, ServersController],
  providers: [CategoriesService, ServersService]
})
export class CatalogAdminModule {}
