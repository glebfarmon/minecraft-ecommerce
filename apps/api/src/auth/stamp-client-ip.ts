import type {IncomingMessage} from 'node:http'

import {CLIENT_IP_HEADER, clientIp} from '../common/client-ip'

/**
 * Runs before every Better Auth request (the integration's `middleware` option): resolves the client
 * address once with the shared rule (it needs the socket peer, which Better Auth's web `Request`
 * lacks) and stamps it on the request, overwriting whatever the client sent in that header.
 * `req` is typed `unknown` because the integration declares `any`; a typed parameter there makes
 * typescript-eslint resolve `forRoot` to its deprecated overload.
 */
export function stampClientIp(req: unknown, _res: unknown, next: (error?: unknown) => void): void {
  const {headers, socket} = req as Pick<IncomingMessage, 'headers' | 'socket'>
  headers[CLIENT_IP_HEADER] = clientIp(headers, socket.remoteAddress)
  next()
}
