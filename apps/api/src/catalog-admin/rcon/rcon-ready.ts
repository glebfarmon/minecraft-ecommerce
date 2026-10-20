import {rconKey} from './rcon-crypto'

/** A server can deliver purchases only with a complete RCON setup and a key that can decrypt its password. */
export function rconReady(
  server: {rconHost: string | null; rconPort: number | null; rconPasswordEnc: string | null},
  env: Partial<Record<string, string>> = process.env
): boolean {
  if (!server.rconHost || server.rconPort === null || !server.rconPasswordEnc) return false
  try {
    rconKey(env)
    return true
  } catch {
    return false
  }
}
