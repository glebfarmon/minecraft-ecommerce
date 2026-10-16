import {Body, Delete, Get, HttpCode, Param, Put, Query, Req} from '@nestjs/common'
import * as v from 'valibot'

import {
  type AdminMessage,
  MessageLocaleSchema,
  MessageOverrideInputSchema
} from '@shop/shared/content'

import {AdminController} from '../access/admin-controller'
import {adminOf} from '../access/admin-request'
import {RequirePermission} from '../access/require-permission'
import {type AuditableRequest, Audited} from '../audit/audit.interceptor'
import {badRequest} from '../common/http-errors'
import {ValibotPipe} from '../common/valibot.pipe'
import {MessagesAdminService} from './messages-admin.service'

const LocaleQuerySchema = v.object({locale: MessageLocaleSchema})

const localeOf = (raw: string): 'en' | 'pl' => {
  const parsed = v.safeParse(MessageLocaleSchema, raw)
  if (!parsed.success) throw badRequest('invalid_locale')
  return parsed.output
}

@AdminController('content/messages')
export class MessagesAdminController {
  constructor(private readonly messages: MessagesAdminService) {}

  @Get()
  @RequirePermission('content.write')
  list(
    @Query(new ValibotPipe(LocaleQuerySchema)) query: {locale: 'en' | 'pl'}
  ): Promise<AdminMessage[]> {
    return this.messages.list(query.locale)
  }

  @Put(':locale/:key')
  @RequirePermission('content.write')
  @Audited('message.override', 'message')
  set(
    @Param('locale') locale: string,
    @Param('key') key: string,
    @Body(new ValibotPipe(MessageOverrideInputSchema))
    body: v.InferOutput<typeof MessageOverrideInputSchema>,
    @Req() req: AuditableRequest
  ): Promise<AdminMessage> {
    return this.messages.set(localeOf(locale), key, body.value, adminOf(req).email)
  }

  @Delete(':locale/:key')
  @HttpCode(204)
  @RequirePermission('content.write')
  @Audited('message.reset', 'message')
  async reset(@Param('locale') locale: string, @Param('key') key: string): Promise<void> {
    await this.messages.reset(localeOf(locale), key)
  }
}
