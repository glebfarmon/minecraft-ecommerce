import {Module} from '@nestjs/common'

import {ContentModule} from '../content/content.module'
import {AdminsController} from './admins.controller'
import {AdminsService} from './admins.service'
import {InviteLookupController} from './invite-lookup.controller'
import {InvitesController} from './invites.controller'
import {InvitesService} from './invites.service'
import {MeController} from './me.controller'
import {RolesController} from './roles.controller'
import {RolesService} from './roles.service'

@Module({
  imports: [ContentModule],
  controllers: [
    MeController,
    AdminsController,
    InvitesController,
    InviteLookupController,
    RolesController
  ],
  providers: [AdminsService, InvitesService, RolesService]
})
export class TeamModule {}
