import path from 'node:path'

import type {NextConfig} from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const repoRoot = path.resolve(process.cwd(), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: {root: repoRoot},
  transpilePackages: ['@shop/ui'],
  images: {formats: ['image/avif', 'image/webp'], qualities: [85]},
  // CLAUDE.md at the repo root is the agent guide; don't generate per-app copies.
  agentRules: false
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
