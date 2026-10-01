import path from 'node:path'

import type {NextConfig} from 'next'

const repoRoot = path.resolve(process.cwd(), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: {root: repoRoot},
  transpilePackages: ['@shop/ui']
}

export default nextConfig
