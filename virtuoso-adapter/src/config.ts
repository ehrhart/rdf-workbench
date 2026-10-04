import type { AppConfig } from './types'

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for the Virtuoso adapter`)
  }
  return value
}

export const config: AppConfig = {
  port: parseNumber(process.env.PORT, 50118),
  adapterToken: process.env.VIRTUOSO_ADAPTER_TOKEN || '',
  virtuoso: {
    driver: process.env.VIRTUOSO_DRIVER || '/usr/lib/odbc/virtodbc.so',
    host: process.env.VIRTUOSO_HOST || 'localhost',
    port: parseNumber(process.env.VIRTUOSO_ISQL_PORT, 1111),
    user: requiredEnv('VIRTUOSO_DBA_USER'),
    password: requiredEnv('VIRTUOSO_DBA_PASSWORD'),
    connectionTimeout: parseNumber(process.env.VIRTUOSO_CONNECTION_TIMEOUT, 30),
    loginTimeout: parseNumber(process.env.VIRTUOSO_LOGIN_TIMEOUT, 10)
  }
}

// Local directory for storing uploaded RDF files before bulk loading.
// Use VIRTUOSO_IMPORTS_PATH when the Virtuoso instance sees the files at a different absolute path.
export const IMPORTS_PATH = process.env.VIRTUOSO_IMPORTS_PATH || './imports'
export const MAX_UPLOAD_BYTES = parseNumber(
  process.env.VIRTUOSO_ADAPTER_MAX_UPLOAD_BYTES,
  100 * 1024 * 1024 * 1024
)
