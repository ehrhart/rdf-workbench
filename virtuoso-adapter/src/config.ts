import type { AppConfig } from './types'

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Application configuration including server port, Virtuoso connection host info,
 * and in-memory session lifecycle settings.
 */
export const config: AppConfig = {
  port: parseNumber(process.env.PORT, 50118),
  adapterToken: process.env.VIRTUOSO_ADAPTER_TOKEN || '',
  virtuoso: {
    driver: process.env.VIRTUOSO_DRIVER || '/usr/lib/odbc/virtodbc.so',
    host: process.env.VIRTUOSO_HOST || 'localhost',
    port: parseNumber(process.env.VIRTUOSO_ISQL_PORT, 1111),
    user: process.env.VIRTUOSO_DBA_USER,
    password: process.env.VIRTUOSO_DBA_PASSWORD,
    connectionTimeout: parseNumber(process.env.VIRTUOSO_CONNECTION_TIMEOUT, 30),
    loginTimeout: parseNumber(process.env.VIRTUOSO_LOGIN_TIMEOUT, 10)
  },
  session: {
    ttlMs: Math.max(
      parseNumber(process.env.VIRTUOSO_ADAPTER_SESSION_TTL_MS, 86_400_000),
      60_000
    ),
    cleanupIntervalMs: Math.max(
      parseNumber(
        process.env.VIRTUOSO_ADAPTER_SESSION_CLEANUP_INTERVAL_MS,
        300_000
      ),
      30_000
    )
  },
  sparqlEndpoint: process.env.SPARQL_ENDPOINT || 'http://localhost:8890/sparql'
}

// Local directory for storing uploaded RDF files before bulk loading.
// Use VIRTUOSO_IMPORTS_PATH when the Virtuoso instance sees the files at a different absolute path.
export const IMPORTS_PATH = process.env.VIRTUOSO_IMPORTS_PATH || './imports'
export const MAX_UPLOAD_BYTES = parseNumber(
  process.env.VIRTUOSO_ADAPTER_MAX_UPLOAD_BYTES,
  100 * 1024 * 1024 * 1024
)
