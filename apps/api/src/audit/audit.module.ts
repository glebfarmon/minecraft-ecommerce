import {Global, Module} from '@nestjs/common'

import {AuditController} from './audit.controller'
import {AuditInterceptor} from './audit.interceptor'
import {AuditService} from './audit.service'

@Global()
@Module({
  providers: [AuditService, AuditInterceptor],
  controllers: [AuditController],
  exports: [AuditService, AuditInterceptor]
})
export class AuditModule {}
