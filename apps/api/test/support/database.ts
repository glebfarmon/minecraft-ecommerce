import {execFileSync} from 'node:child_process'
import path from 'node:path'

import {PostgreSqlContainer} from '@testcontainers/postgresql'

export const API_ROOT = path.resolve(__dirname, '..', '..')

export function prisma(args: string[], url: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_ROOT,
    env: {...process.env, DATABASE_URL: url},
    encoding: 'utf8'
  })
}

/** A throwaway Postgres with all migrations applied; sets DATABASE_URL for clients created afterwards. */
export async function startDatabase(): Promise<{url: string; stop: () => Promise<void>}> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start()
  const url = container.getConnectionUri()
  prisma(['migrate', 'deploy'], url)
  process.env.DATABASE_URL = url
  return {
    url,
    stop: async () => {
      await container.stop()
    }
  }
}
