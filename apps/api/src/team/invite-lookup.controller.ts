import {Controller, Get, Param} from '@nestjs/common'
import {AllowAnonymous} from '@thallesp/nestjs-better-auth'

import type {InviteLookup} from '@shop/shared/access'

import {notFound} from './errors'
import {InvitesService} from './invites.service'

/** Anonymous status of an invite link for the invite page: email and status, never the role. */
@AllowAnonymous()
@Controller('invite-lookup')
export class InviteLookupController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  async get(@Param('token') token: string): Promise<InviteLookup> {
    const found = await this.invites.lookup(token)
    if (!found) throw notFound()
    return found
  }
}
