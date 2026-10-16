import {Body, Delete, Get, HttpCode, Param, Patch, Post, Query, Req} from '@nestjs/common'

import {
  type AdminCategory,
  type CategoryInput,
  CategoryInputSchema,
  type CategoryUpdate,
  CategoryUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {CategoriesService} from './categories.service'

@AdminController('catalog/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(): Promise<AdminCategory[]> {
    return this.categories.list()
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited('category.create', 'category')
  create(@Body(new ValibotPipe(CategoryInputSchema)) body: CategoryInput): Promise<AdminCategory> {
    return this.categories.create(body)
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited('category.update', 'category')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(CategoryUpdateSchema)) body: CategoryUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminCategory> {
    return this.categories.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('category.delete', 'category')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.categories.remove(id, query.version, before => {
      req.auditBefore = before
    })
  }
}
