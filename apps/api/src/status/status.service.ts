import {Injectable} from '@nestjs/common'

export interface ServerStatus {
  online: boolean
  players: number
}

const DEFAULT_ADDRESS = 'mc.mineblaze.net'
const OK_TTL_MS = 30_000
// A failed lookup is retried sooner, but still not on every page view.
const FAIL_TTL_MS = 10_000
const TIMEOUT_MS = 3_000

const OFFLINE: ServerStatus = {online: false, players: 0}

/** Player count of the game server, from mcstatus.io, cached so page views never hit the upstream directly. */
@Injectable()
export class StatusService {
  private cached?: {value: Promise<ServerStatus>; expiresAt: number}

  get(): Promise<ServerStatus> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value
    // Stored before it settles, so concurrent callers share one upstream request.
    const entry = {value: this.fetchStatus(), expiresAt: Date.now() + FAIL_TTL_MS}
    this.cached = entry
    void entry.value.then(status => {
      if (status.online) entry.expiresAt = Date.now() + OK_TTL_MS
    })
    return entry.value
  }

  private async fetchStatus(): Promise<ServerStatus> {
    const address = process.env.MC_SERVER_ADDRESS ?? DEFAULT_ADDRESS
    try {
      const res = await fetch(
        `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`,
        {signal: AbortSignal.timeout(TIMEOUT_MS)}
      )
      if (!res.ok) return OFFLINE
      const body = (await res.json()) as {online?: unknown; players?: {online?: unknown}}
      const players = body.players?.online
      if (body.online !== true || typeof players !== 'number') return OFFLINE
      return {online: true, players}
    } catch {
      return OFFLINE
    }
  }
}
