import {Global, Module} from '@nestjs/common'

import {getAuth} from '../auth/auth'
import {AdminSessionGuard, SESSION_READER, type SessionReader} from './admin-session.guard'
import {PermissionCache} from './permission-cache'
import {PermissionGuard} from './require-permission'

const readSession: SessionReader = headers => getAuth().api.getSession({headers})

@Global()
@Module({
  providers: [
    {provide: SESSION_READER, useValue: readSession},
    PermissionCache,
    PermissionGuard,
    AdminSessionGuard
  ],
  exports: [SESSION_READER, PermissionCache, AdminSessionGuard, PermissionGuard]
})
export class AccessModule {}
