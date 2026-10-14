import path from 'node:path'

import type {NextConfig} from 'next'

const repoRoot = path.resolve(process.cwd(), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: {root: repoRoot},
  transpilePackages: ['@shop/ui'],
  // In production a reverse proxy serves /api; in dev the API runs on its own port, so forward it.
  rewrites: () =>
    Promise.resolve(
      process.env.NODE_ENV === 'production'
        ? []
        : [
            {
              source: '/api/:path*',
              destination: `${process.env.API_ORIGIN ?? 'http://localhost:4000'}/api/:path*`
            }
          ]
    )
}

export default nextConfig
