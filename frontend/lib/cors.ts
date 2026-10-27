import 'server-only'

import type { NextResponse } from 'next/server'

/**
 * CORS policy for the public SPARQL query endpoints, resolved from the
 * environment on each request:
 *
 * - `CORS_ENABLED`: `0` or `false` turns cross-origin browser access off;
 *   any other value, including unset, leaves it on.
 * - `CORS_ALLOWED_ORIGINS`: `*` (the default) allows every origin. A
 *   comma-separated list allows exactly those origins, matched exactly and
 *   echoed back per request.
 * - `CORS_EXPOSE_HEADERS`: comma-separated response header names exposed to
 *   browser clients beyond the CORS-safelisted ones.
 */

export interface CorsConfig {
  enabled: boolean
  allowedOrigins: '*' | readonly string[]
  exposeHeaders: readonly string[]
}

const CORS_METHODS = 'GET, HEAD, POST, OPTIONS'
const CORS_REQUEST_HEADERS = 'Accept, Authorization, Content-Type'
const CORS_MAX_AGE = '86400'

export function getCorsConfig(): CorsConfig {
  return {
    enabled: parseEnabled(process.env.CORS_ENABLED),
    allowedOrigins: parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    exposeHeaders: parseHeaderList(process.env.CORS_EXPOSE_HEADERS)
  }
}

/**
 * The origins a request may cross from, or null when access is not granted.
 * `'*'` allows every origin; a configured list echoes the exact match.
 */
export function corsAllowOrigin(
  requestOrigin: string | null,
  config: CorsConfig
): string | null {
  if (config.allowedOrigins === '*') return '*'
  if (requestOrigin && config.allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }
  return null
}

/**
 * Stamps the granted CORS headers onto an existing response with append
 * semantics, so a `Vary` the response already carries merges instead of
 * being replaced. Covers preflights and actual responses alike.
 */
export function applyCorsHeaders(
  response: NextResponse,
  allowOrigin: string,
  config: CorsConfig
): void {
  response.headers.append('Access-Control-Allow-Origin', allowOrigin)
  response.headers.append('Access-Control-Allow-Methods', CORS_METHODS)
  response.headers.append('Access-Control-Allow-Headers', CORS_REQUEST_HEADERS)
  response.headers.append('Access-Control-Max-Age', CORS_MAX_AGE)
  if (config.exposeHeaders.length > 0) {
    response.headers.append(
      'Access-Control-Expose-Headers',
      config.exposeHeaders.join(', ')
    )
  }
  if (allowOrigin !== '*') {
    // The allow-origin value now depends on the request origin, so caches
    // must not share one origin's response with another.
    response.headers.append('Vary', 'Origin')
  }
}

function parseEnabled(value: string | undefined): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return normalized !== '0' && normalized !== 'false'
}

function parseAllowedOrigins(
  value: string | undefined
): '*' | readonly string[] {
  const origins = parseHeaderList(value)
  if (origins.length === 0 || origins.includes('*')) return '*'
  return origins
}

function parseHeaderList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
