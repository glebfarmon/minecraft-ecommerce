import {Body, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req} from '@nestjs/common'

import {
  type AdminProduct,
  type AdminProductListItem,
  OrderInputSchema,
  type ProductCreate,
  ProductCreateSchema,
  type ProductListQuery,
  ProductListQuerySchema,
  type ProductUpdate,
  ProductUpdateSchema,
  VersionQuerySchema
} from '@shop/shared/catalog-admin'

import {AdminController} from '../access/admin-controller'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {ValibotPipe} from '../common/valibot.pipe'
import {ProductsService} from './products.service'

@AdminController('catalog')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products')
  list(
    @Query(new ValibotPipe(ProductListQuerySchema)) query: ProductListQuery
  ): Promise<AdminProductListItem[]> {
    return this.products.list(query)
  }

  @Get('products/:id')
  get(@Param('id') id: string): Promise<AdminProduct> {
    return this.products.get(id)
  }

  @Post('products')
  @RequirePermission('catalog.write')
  @Audited('product.create', 'product')
  create(@Body(new ValibotPipe(ProductCreateSchema)) body: ProductCreate): Promise<AdminProduct> {
    return this.products.create(body)
  }

  @Patch('products/:id')
  @RequirePermission('catalog.write')
  @Audited('product.update', 'product')
  update(
    @Param('id') id: string,
    @Body(new ValibotPipe(ProductUpdateSchema)) body: ProductUpdate,
    @Req() req: AuditableRequest
  ): Promise<AdminProduct> {
    return this.products.update(id, body, before => {
      req.auditBefore = before
    })
  }

  @Put('servers/:serverId/categories/:categoryId/products/order')
  @RequirePermission('catalog.write')
  @Audited('product.order', 'product')
  order(
    @Param('serverId') serverId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ValibotPipe(OrderInputSchema)) body: {ids: string[]}
  ): Promise<AdminProductListItem[]> {
    return this.products.order(serverId, categoryId, body.ids)
  }

  @Delete('products/:id')
  @HttpCode(204)
  @RequirePermission('catalog.write')
  @Audited('product.delete', 'product')
  remove(
    @Param('id') id: string,
    @Query(new ValibotPipe(VersionQuerySchema)) query: {version: number},
    @Req() req: AuditableRequest
  ): Promise<void> {
    return this.products.remove(id, query.version, before => {
      req.auditBefore = before
    })
  }
}
