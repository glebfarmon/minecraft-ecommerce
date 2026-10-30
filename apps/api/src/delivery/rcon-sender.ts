import {Rcon} from 'rcon-client'

import type {RconTarget} from '../catalog-admin/rcon/rcon-tester'
import type {SendOutcome} from './delivery-rules'

/** Swappable in tests; the app binds `RconClientSender`. */
export interface RconSender {
  send(target: RconTarget, commands: readonly string[], timeoutMs: number): Promise<SendOutcome>
}
export const RCON_SENDER = Symbol('RCON_SENDER')

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Runs the commands in order on one connection; never throws. Failing to connect or sign in, or
 * before a command is written, is `retryable`. Once a command was written, a timeout or a lost
 * socket means the server may have run it: `unconfirmed`.
 */
export class RconClientSender implements RconSender {
  async send(
    target: RconTarget,
    commands: readonly string[],
    timeoutMs: number
  ): Promise<SendOutcome> {
    const replies: string[] = []
    let timer: NodeJS.Timeout | undefined
    const rcon = new Rcon({...target, timeout: timeoutMs})
    // Socket errors surface as rejected sends; an unhandled 'error' event would crash the process.
    rcon.on('error', () => undefined)
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout'))
      }, timeoutMs)
    })
    deadline.catch(() => undefined)
    const connecting = rcon.connect()
    connecting.catch(() => undefined)
    try {
      try {
        await Promise.race([connecting, deadline])
      } catch (error) {
        return {kind: 'retryable', replies, error: messageOf(error)}
      }
      clearTimeout(timer)
      for (const command of commands) {
        try {
          replies.push(await rcon.send(command))
        } catch (error) {
          const message = messageOf(error)
          // "Not connected" is thrown before anything is written.
          if (message === 'Not connected') return {kind: 'retryable', replies, error: message}
          return {kind: 'unconfirmed', replies, error: message}
        }
      }
      return {kind: 'done', replies}
    } finally {
      clearTimeout(timer)
      rcon.socket?.destroy()
    }
  }
}
