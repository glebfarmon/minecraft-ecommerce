import {encryptRconPassword, rconKey} from '../catalog-admin/rcon/rcon-crypto'
import type {PrismaClient} from '../generated/prisma/client'

/**
 * Local and e2e stacks only: gives every server without RCON the endpoint from `SEED_RCON_HOST`, `SEED_RCON_PORT` and
 * `SEED_RCON_PASSWORD` (password encrypted with `RCON_ENCRYPTION_KEY`), so products can be bought there. Never
 * overwrites a configured server, and does nothing unless all three variables are set.
 */
export async function seedDemoRcon(
  prisma: PrismaClient,
  env: Partial<Record<string, string>> = process.env
): Promise<void> {
  const {SEED_RCON_HOST: host, SEED_RCON_PORT: port, SEED_RCON_PASSWORD: password} = env
  if (!host || !port || !password) return
  const rconPasswordEnc = encryptRconPassword(password, rconKey(env))
  await prisma.server.updateMany({
    where: {rconHost: null},
    data: {rconHost: host, rconPort: Number(port), rconPasswordEnc}
  })
}
