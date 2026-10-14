import {Global, Module} from '@nestjs/common'

import {getMailer} from './create-mailer'
import {MAILER} from './mailer'

@Global()
@Module({providers: [{provide: MAILER, useFactory: getMailer}], exports: [MAILER]})
export class MailerModule {}
