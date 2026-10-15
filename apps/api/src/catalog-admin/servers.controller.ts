import {Body, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req} from '@nestjs/common'

import {hasPermission} from '@shop/shared/access'
import {
  type AdminServer,
  OrderInputSchema,
  type ServerCategoriesInput,
  ServerCategoriesInputSchema,
  type ServerCreate,
  ServerCreateSchema,
  type ServerUpdate,
  ServerUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {ServersService} from './servers.service'

const withRcon = (req: AuditableRequest) => hasPermission(adminOf(req).permissions, 'server.rcon')

@AdminController('catalog/servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  list(@Req() req: AuditableRequest): Promise<AdminServer[]> {
    return this.servers.list(withRcon(req))
  }

  // Declared before ':id' routes so `order` is never read as an id.
  @Put('order')
  @RequirePermission('catalog.write')
  @Audited('server.order', 'server')
  order(
    @Body(new ValibotPipe(OrderInputSchema)) body: {ids: string[]},
    @Req() req: AuditableRequest
  ): Promise<AdminServer[]> {
    return this.servers.order(body.ids, withRcon(req))
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuditableRequest): Promise<AdminServer> {
    return this.servers.get(id, withRcon(req))
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited('server.create', 'server')
  create(
    @Body(new ValibotPipe(ServerCreateSchema)) body: ServerCreate,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.create(body, withRcon(req))
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited('server.update', 'server')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(ServerUpdateSchema)) body: ServerUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.update(id, body, withRcon(req), before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('server.delete', 'server')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.servers.remove(id, query.version, withRcon(req), before => {
      req.auditBefore = before
    })
  }

  @Put(':id/categories')
  @RequirePermission('catalog.write')
  @Audited('server.categories', 'server')
  setCategories(
    @Param('id') id: string,
    @Body(new ValibotPipe(ServerCategoriesInputSchema)) body: ServerCategoriesInput,
    @Req() req: AuditableRequest
  ): Promise<AdminServer> {
    return this.servers.setCategories(id, body, withRcon(req), before => {
      req.auditBefore = before
    })
  }
}
