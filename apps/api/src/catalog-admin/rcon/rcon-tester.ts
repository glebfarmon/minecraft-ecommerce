import {Rcon} from 'rcon-client'

import type {RconTestResult} from '@shop/shared/catalog-admin'

export type RconTarget = {host: string; port: number; password: string}

/** Swappable in tests; the app binds `RconClientTester`. */
export interface RconTester {
  test(target: RconTarget, timeoutMs: number): Promise<RconTestResult>
}
export const RCON_TESTER = Symbol('RCON_TESTER')

const failure = (error: unknown): Extract<RconTestResult, {ok: false}>['error'] => {
  const message = error instanceof Error ? error.message : ''
  if (/auth/i.test(message)) return 'auth_failed'
  if (/timeout|timed out/i.test(message)) return 'timeout'
  return 'unreachable'
}

/** Signs in and runs `list`; never throws, so a bad target is a result, not a 5xx. */
export class RconClientTester implements RconTester {
  async test(target: RconTarget, timeoutMs: number): Promise<RconTestResult> {
    const started = performance.now()
    let timer: NodeJS.Timeout | undefined
    const rcon = new Rcon({...target, timeout: timeoutMs})
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout'))
      }, timeoutMs)
    })
    // Whichever promise loses the race must not become an unhandled rejection.
    deadline.catch(() => undefined)
    const connecting = rcon.connect()
    connecting.catch(() => undefined)
    try {
      // rcon-client's own timeout covers replies, not a connect that hangs; the race covers both.
      await Promise.race([connecting, deadline])
      await Promise.race([rcon.send('list'), deadline])
      return {ok: true, ms: Math.round(performance.now() - started)}
    } catch (error) {
      return {ok: false, error: failure(error)}
    } finally {
      clearTimeout(timer)
      // end() waits for 'close' and cannot run on a half-open connect; destroy always works.
      rcon.socket?.destroy()
    }
  }
}
