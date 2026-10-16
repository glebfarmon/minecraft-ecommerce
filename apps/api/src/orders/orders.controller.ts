import type {IncomingMessage} from 'node:http'

import {Body, Controller, Get, Header, Param, Post, Req} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import {
  type CreateOrderRequest,
  CreateOrderRequestSchema,
  type CreateOrderResponse,
  PUBLIC_ID_PATTERN,
  type PublicOrder
} from '@shop/shared/orders'

import {clientIp} from '../common/client-ip'
import {notFound} from '../common/http-errors'
import {ValibotPipe} from '../common/valibot.pipe'
import {OrdersService} from './orders.service'

@AllowAnonymous()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body(new ValibotPipe(CreateOrderRequestSchema)) body: CreateOrderRequest,
    @Req() req: IncomingMessage
  ): Promise<CreateOrderResponse> {
    return this.orders.create(body, clientIp(req.headers, req.socket.remoteAddress))
  }

  @Get(':publicId')
  @Header('Cache-Control', 'no-store')
  get(@Param('publicId') publicId: string): Promise<PublicOrder> {
    if (!PUBLIC_ID_PATTERN.test(publicId)) throw notFound()
    return this.orders.getPublic(publicId)
  }
}
