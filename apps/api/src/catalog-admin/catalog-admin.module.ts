import {Module} from '@nestjs/common'

import {CategoriesController} from './categories.controller'
import {CategoriesService} from './categories.service'
import {RCON_TESTER, RconClientTester} from './rcon/rcon-tester'
import {ServerRconController} from './rcon/server-rcon.controller'
import {ServerRconService} from './rcon/server-rcon.service'
import {ServersController} from './servers.controller'
import {ServersService} from './servers.service'

/** Catalog management for the admin app (sub-project 3b). */
@Module({
  controllers: [CategoriesController, ServersController, ServerRconController],
  providers: [
    CategoriesService,
    ServersService,
    ServerRconService,
    {provide: RCON_TESTER, useClass: RconClientTester}
  ]
})
export class CatalogAdminModule {}
