import 'server-only'

import { NextResponse } from 'next/server'
import { getRuntimeConfig } from '@/lib/runtime/config'

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const allowedOrigins = new Set([
    new URL(request.url).origin,
    new URL(getRuntimeConfig().WORKBENCH_URL).origin
  ])
  return allowedOrigins.has(origin)
}

export function sameOriginError(): NextResponse {
  return NextResponse.json(
    { error: 'Cross-origin mutations are not allowed' },
    { status: 403 }
  )
}
