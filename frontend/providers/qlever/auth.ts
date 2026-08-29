import 'server-only'

import crypto from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { cookies } from 'next/headers'
import { AuthError, QueryError } from '@/lib/errors'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  AuthAdapter,
  LoginCredentials,
  Principal
} from '@/lib/runtime/contracts'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

const SESSION_COOKIE_NAME = 'session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
export const PASSWORD_MIN_LENGTH = 12

interface UserRow {
  id: string
  username: string
  password_hash: string
  role: 'admin' | 'user'
  disabled: number
}

export interface LocalUser {
  id: string
  username: string
  role: 'admin' | 'user'
  disabled: boolean
  createdAt: string
  updatedAt: string
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function asPrincipal(
  row: Pick<UserRow, 'id' | 'username' | 'role'>
): Principal {
  return { id: row.id, username: row.username, role: row.role }
}

async function createLocalSession(user: Principal): Promise<void> {
  const db = await getWorkbenchDatabase()
  const token = crypto.randomBytes(32).toString('base64url')
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS)

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(
    tokenHash(token),
    user.id,
    createdAt.toISOString(),
    expiresAt.toISOString()
  )

  const cookieStore = await cookies()
  const config = getRuntimeConfig()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  })
}

export async function loginLocalUser(
  credentials: LoginCredentials
): Promise<Principal> {
  const db = await getWorkbenchDatabase()
  const username = credentials.username.trim().toLowerCase()
  const row = db
    .prepare(`
      SELECT id, username, password_hash, role, disabled
      FROM users
      WHERE username = ? COLLATE NOCASE
    `)
    .get(username) as UserRow | undefined

  if (
    !row ||
    row.disabled ||
    !(await verify(row.password_hash, credentials.password))
  ) {
    throw new AuthError('Invalid username or password')
  }

  const principal = asPrincipal(row)
  await createLocalSession(principal)
  return principal
}

export async function getLocalPrincipal(): Promise<Principal | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const db = await getWorkbenchDatabase()
  const now = new Date().toISOString()
  const row = db
    .prepare(`
      SELECT u.id, u.username, u.role, u.disabled, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(tokenHash(token)) as
    | (Pick<UserRow, 'id' | 'username' | 'role' | 'disabled'> & {
        expires_at: string
      })
    | undefined

  if (!row || row.disabled || row.expires_at <= now) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(
      tokenHash(token)
    )
    return null
  }

  return asPrincipal(row)
}

export async function logoutLocalUser(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    const db = await getWorkbenchDatabase()
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(
      tokenHash(token)
    )
  }
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export const qleverAuthAdapter: AuthAdapter = {
  login: loginLocalUser,
  getPrincipal: getLocalPrincipal,
  logout: logoutLocalUser,
  requireRole: requireLocalRole
}

export async function requireLocalRole(
  role: Principal['role']
): Promise<Principal> {
  const principal = await getLocalPrincipal()
  if (!principal || principal.role !== role) {
    throw new AuthError(
      `${role === 'admin' ? 'Administrator' : 'User'} access required`
    )
  }
  return principal
}

export function requireLocalAdmin(): Promise<Principal> {
  return requireLocalRole('admin')
}

export async function listLocalUsers(): Promise<LocalUser[]> {
  await requireLocalAdmin()
  const db = await getWorkbenchDatabase()
  const rows = db
    .prepare(`
      SELECT id, username, role, disabled, created_at, updated_at
      FROM users ORDER BY username COLLATE NOCASE
    `)
    .all() as Array<{
    id: string
    username: string
    role: 'admin' | 'user'
    disabled: number
    created_at: string
    updated_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    disabled: Boolean(row.disabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function createLocalUser(input: {
  username: string
  password: string
  role: 'admin' | 'user'
}): Promise<void> {
  await requireLocalAdmin()
  const username = input.username.trim().toLowerCase()
  if (!username) throw new QueryError('Username is required')
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    throw new QueryError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  }

  const db = await getWorkbenchDatabase()
  const now = new Date().toISOString()
  const passwordHash = await hash(input.password)
  try {
    db.prepare(`
      INSERT INTO users
        (id, username, password_hash, role, disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), username, passwordHash, input.role, now, now)
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new QueryError('A user with that username already exists')
    }
    throw error
  }
}

export async function setLocalUserDisabled(
  userId: string,
  disabled: boolean
): Promise<void> {
  const administrator = await requireLocalAdmin()
  const db = await getWorkbenchDatabase()
  const target = db
    .prepare('SELECT id, role, disabled FROM users WHERE id = ?')
    .get(userId) as Pick<UserRow, 'id' | 'role' | 'disabled'> | undefined
  if (!target) throw new QueryError('User not found')

  if (disabled && target.role === 'admin' && !target.disabled) {
    const activeAdmins = db
      .prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND disabled = 0"
      )
      .get() as { count: number }
    if (activeAdmins.count <= 1) {
      throw new QueryError('The final active administrator cannot be disabled')
    }
  }
  if (disabled && target.id === administrator.id) {
    throw new QueryError('You cannot disable your own account')
  }

  db.transaction(() => {
    db.prepare(
      'UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?'
    ).run(disabled ? 1 : 0, new Date().toISOString(), userId)
    if (disabled) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    }
  })()
}

export async function resetLocalUserPassword(
  userId: string,
  password: string
): Promise<void> {
  await requireLocalAdmin()
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new QueryError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  }
  const db = await getWorkbenchDatabase()
  const passwordHash = await hash(password)
  db.transaction(() => {
    const result = db
      .prepare(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
      )
      .run(passwordHash, new Date().toISOString(), userId)
    if (result.changes === 0) throw new QueryError('User not found')
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  })()
}
