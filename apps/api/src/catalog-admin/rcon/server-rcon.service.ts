import {Inject, Injectable} from '@nestjs/common'

import type {AdminServer, RconInput, RconTestResult} from '@shop/shared/catalog-admin'

import {badRequest, notFound, serviceUnavailable} from '../../common/http-errors'
import type {Prisma} from '../../generated/prisma/client'
import {PrismaService} from '../../prisma/prisma.service'
import {serverInclude, toAdminServer} from '../servers.mapper'
import {RconKeyMissingError, decryptRconPassword, encryptRconPassword, rconKey} from './rcon-crypto'
import {RconHostPrivateError, resolveRconHost} from './rcon-host'
import {RCON_TESTER, type RconTester} from './rcon-tester'

const TEST_TIMEOUT_MS = 5000

@Injectable()
export class ServerRconService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RCON_TESTER) private readonly tester: RconTester
  ) {}

  private key(): Buffer {
    try {
      return rconKey()
    } catch (error) {
      if (error instanceof RconKeyMissingError) throw serviceUnavailable('rcon_key_missing')
      throw error
    }
  }

  /** Private → 400; a name that does not resolve → 400 on save, `unreachable` on test. */
  private async address(host: string): Promise<string | null> {
    try {
      return await resolveRconHost(host)
    } catch (error) {
      if (error instanceof RconHostPrivateError) throw badRequest('rcon_host_private')
      return null
    }
  }

  async update(
    id: string,
    input: RconInput,
    before: (s: AdminServer) => void
  ): Promise<AdminServer> {
    const current = await this.prisma.server.findUnique({where: {id}, include: serverInclude})
    if (!current) throw notFound()
    if (input.host !== null && (await this.address(input.host)) === null)
      throw badRequest('rcon_host_unresolvable')
    before(toAdminServer(current, true))
    const data: Prisma.ServerUpdateInput = {rconHost: input.host, rconPort: input.port}
    if (input.password !== undefined)
      data.rconPasswordEnc = encryptRconPassword(input.password, this.key())
    if (input.clearPassword === true) data.rconPasswordEnc = null
    // Not versioned: RCON fields are not part of the server form, and last write wins here.
    const row = await this.prisma.server.update({where: {id}, data, include: serverInclude})
    return toAdminServer(row, true)
  }

  async test(id: string): Promise<RconTestResult> {
    const server = await this.prisma.server.findUnique({where: {id}})
    if (!server) throw notFound()
    const {rconHost: host, rconPort: port, rconPasswordEnc: stored} = server
    if (!host || !port || !stored) throw badRequest('rcon_not_configured')
    const key = this.key()
    let password: string
    try {
      password = decryptRconPassword(stored, key)
    } catch {
      return {ok: false, error: 'decrypt_failed'}
    }
    const address = await this.address(host)
    if (address === null) return {ok: false, error: 'unreachable'}
    return this.tester.test({host: address, port, password}, TEST_TIMEOUT_MS)
  }
}
