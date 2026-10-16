import {Controller, Get, Header, Query} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'
import * as v from 'valibot'

import {MessageLocaleSchema, type SiteSettings} from '@shop/shared/content'
import type {PublicRules} from '@shop/shared/rules'

import {ValibotPipe} from '../common/valibot.pipe'
import {ContentService} from './content.service'

const LocaleQuery = v.object({locale: MessageLocaleSchema})
type LocaleQuery = v.InferOutput<typeof LocaleQuery>

@AllowAnonymous()
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('rules')
  @Header('Cache-Control', 'no-store')
  rules(@Query(new ValibotPipe(LocaleQuery)) q: LocaleQuery): Promise<PublicRules> {
    return this.content.rules(q.locale)
  }

  @Get('messages')
  @Header('Cache-Control', 'no-store')
  messages(@Query(new ValibotPipe(LocaleQuery)) q: LocaleQuery): Promise<Record<string, string>> {
    return this.content.messages(q.locale)
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  settings(): Promise<SiteSettings> {
    return this.content.settings()
  }
}
