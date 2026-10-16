import {Module} from '@nestjs/common'

import {ContentController} from './content.controller'
import {ContentService} from './content.service'
import {RulesAdminController} from './rules-admin.controller'
import {RulesAdminService} from './rules-admin.service'

@Module({
  controllers: [ContentController, RulesAdminController],
  providers: [ContentService, RulesAdminService]
})
export class ContentModule {}
