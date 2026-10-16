import {Module} from '@nestjs/common'

import {ContentController} from './content.controller'
import {ContentService} from './content.service'
import {MessagesAdminController} from './messages-admin.controller'
import {MessagesAdminService} from './messages-admin.service'
import {RulesAdminController} from './rules-admin.controller'
import {RulesAdminService} from './rules-admin.service'
import {SettingsAdminController} from './settings-admin.controller'
import {SettingsAdminService} from './settings-admin.service'

@Module({
  controllers: [
    ContentController,
    RulesAdminController,
    MessagesAdminController,
    SettingsAdminController
  ],
  providers: [ContentService, RulesAdminService, MessagesAdminService, SettingsAdminService]
})
export class ContentModule {}
