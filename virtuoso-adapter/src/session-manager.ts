import crypto from 'node:crypto'
import * as odbc from 'odbc'
import { config } from './config'
import { logger } from './logger'
import type { LoginResponse, VirtuosoUser } from './types'

export interface VirtuosoSession {
  token: string
  username: string
  userId: string
  pool: odbc.Pool
  createdAt: number
  lastUsed: number
}

interface UserRow {
  U_ID: string | number
  U_NAME: string
}

const sessions = new Map<string, VirtuosoSession>()

function sanitizeCredentialInput(value: string): string {
  return value.trim()
}

function buildConnectionString(username: string, password: string): string {
  const base = `DRIVER=${config.virtuoso.driver};HOST=${config.virtuoso.host};PORT=${config.virtuoso.port}`
  return `${base};UID=${username};PWD=${password};CHARSET=UTF-8;`
}

async function lookupUser(
  connection: odbc.Connection,
  username: string
): Promise<VirtuosoUser> {
  try {
    const lowerUser = username.toLowerCase()
    const rows = await connection.query<UserRow>(
      'SELECT U_ID, U_NAME FROM DB.DBA.SYS_USERS WHERE LOWER(U_NAME) = ?',
      [lowerUser]
    )

    if (rows.length > 0) {
      const record = rows[0]
      return {
        id: String(record.U_ID),
        username: record.U_NAME
      }
    }
  } catch (error) {
    const err = error as Error
    logger.warn('Failed to fetch user metadata from Virtuoso', {
      error: err.message
    })
  }

  return {
    id: username,
    username
  }
}

function sessionExpired(session: VirtuosoSession): boolean {
  const now = Date.now()
  return now - session.lastUsed > config.session.ttlMs
}

export async function createUserSession(
  usernameInput: string,
  passwordInput: string
): Promise<LoginResponse> {
  const username = sanitizeCredentialInput(usernameInput)
  const password = sanitizeCredentialInput(passwordInput)

  if (!username || !password) {
    throw new Error('Username and password are required')
  }

  const connectionString = buildConnectionString(username, password)

  // First, test the connection to verify credentials
  const testConnection = await odbc.connect({
    connectionString,
    connectionTimeout: config.virtuoso.connectionTimeout,
    loginTimeout: config.virtuoso.loginTimeout
  })
  await testConnection.close()

  // If successful, create the pool
  const pool = await odbc.pool({
    connectionString,
    connectionTimeout: config.virtuoso.connectionTimeout,
    loginTimeout: config.virtuoso.loginTimeout
  })
  try {
    const connection = await pool.connect()
    let user: VirtuosoUser | null = null

    try {
      user = await lookupUser(connection, username)
    } finally {
      await connection.close()
    }

    const token = crypto.randomUUID()
    const session: VirtuosoSession = {
      token,
      username: user.username,
      userId: user.id,
      pool,
      createdAt: Date.now(),
      lastUsed: Date.now()
    }

    sessions.set(token, session)
    logger.info('Created Virtuoso session for user', {
      username: user.username,
      token
    })

    return { token, user }
  } catch (error) {
    const err = error as any
    logger.error('Failed to connect to Virtuoso during login', {
      error: err.message,
      odbcErrors: err.odbcErrors,
      stack: err.stack,
      username
    })
    await pool.close().catch((closeErr) => {
      logger.warn('Failed to close Virtuoso pool after login failure', {
        error: (closeErr as Error).message
      })
    })
    throw error
  }
}

export function getSession(token: string): VirtuosoSession {
  const session = sessions.get(token)
  if (!session) {
    throw new Error('Invalid session token')
  }

  if (sessionExpired(session)) {
    void destroySession(token)
    throw new Error('Session expired')
  }

  session.lastUsed = Date.now()
  return session
}

export async function destroySession(token: string): Promise<void> {
  const session = sessions.get(token)
  if (!session) {
    return
  }

  sessions.delete(token)
  try {
    await session.pool.close()
    logger.info('Closed Virtuoso session', { username: session.username })
  } catch (error) {
    logger.warn('Failed to close Virtuoso pool during logout', {
      error: (error as Error).message
    })
  }
}

export async function destroyAllSessions(): Promise<void> {
  const tokens = Array.from(sessions.keys())
  await Promise.all(tokens.map((token) => destroySession(token)))
}

export let adminPool: odbc.Pool | null = null

export async function initAdminPool(): Promise<void> {
  if (!config.virtuoso.user || !config.virtuoso.password) {
    return
  }

  const connectionString = buildConnectionString(
    config.virtuoso.user,
    config.virtuoso.password
  )
  adminPool = await odbc.pool({
    connectionString,
    connectionTimeout: config.virtuoso.connectionTimeout,
    loginTimeout: config.virtuoso.loginTimeout
  })
}

export async function getAdminConnection(): Promise<odbc.Connection> {
  if (!adminPool) {
    throw new Error('Admin pool not initialized')
  }

  return await adminPool.connect()
}

export function getAdminSession(): VirtuosoSession {
  if (!adminPool) {
    throw new Error('Admin pool not initialized')
  }

  return {
    token: 'adapter-service',
    username: config.virtuoso.user || 'DBA',
    userId: config.virtuoso.user || 'DBA',
    pool: adminPool,
    createdAt: Date.now(),
    lastUsed: Date.now()
  }
}
