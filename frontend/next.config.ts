import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as { version: string }

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  poweredByHeader: false,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ]
      }
    ]
  },
  async redirects() {
    return [{ source: '/', destination: '/overview', permanent: false }]
  }
}

export default nextConfig
