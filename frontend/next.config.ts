import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as { version: string }

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version
  }
}

export default nextConfig
