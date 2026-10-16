import {Body, HttpCode, Param, Post, Put, Req} from '@nestjs/common'

import {
  type AdminServer,
  type RconInput,
  RconInputSchema,
  type RconTestResult
} from '@shop/shared/catalog-admin'

import {AdminController} from '../../access/admin-controller'
import {RequirePermission} from '../../access/require-permission'
import {type AuditableRequest, Audited} from '../../audit/audit.interceptor'
import {ValibotPipe} from '../../common/valibot.pipe'
import {ServerRconService} from './server-rcon.service'

@AdminController('catalog/servers')
export class ServerRconController {
  constructor(private readonly rcon: ServerRconService) {}

  @Put(':id/rcon')
  @RequirePermission('server.rcon')
  @Audited('server.rcon', 'server')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(RconInputSchema)) body: RconInput,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.rcon.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Post(':id/rcon/test')
  @HttpCode(200)
  @RequirePermission('server.rcon')
  @Audited('server.rcon_test', 'server')
  test(@Param('id') id: string): Promise<RconTestResult> {
    return this.rcon.test(id)
  }
}
