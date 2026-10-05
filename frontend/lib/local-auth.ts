import 'server-only'

import crypto from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { cookies } from 'next/headers'
import { PASSWORD_MIN_LENGTH } from '@/lib/definitions'
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

interface UserRow {
  id: string
  username: string
  password_hash: string
  role: 'admin' | 'user'
  disabled: number
  must_change_password: number
}

export interface LocalUser {
  id: string
  username: string
  role: 'admin' | 'user'
  disabled: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function asPrincipal(
  row: Pick<UserRow, 'id' | 'username' | 'role' | 'must_change_password'>
): Principal {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChangePassword: row.must_change_password === 1
  }
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
      SELECT id, username, password_hash, role, disabled, must_change_password
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

/**
 * Validates a raw session token against the workbench database: the
 * sha256 token hash must exist, belong to an enabled user and be
 * unexpired; expired or unknown tokens are deleted. Shared by
 * `getLocalPrincipal` (cookie-based) and the proxy, which passes the
 * token from the request cookie.
 */
export async function getLocalPrincipalByToken(
  token: string | undefined
): Promise<Principal | null> {
  if (!token) return null

  const db = await getWorkbenchDatabase()
  const now = new Date().toISOString()
  const row = db
    .prepare(`
      SELECT u.id, u.username, u.role, u.disabled, u.must_change_password, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(tokenHash(token)) as
    | (Pick<
        UserRow,
        'id' | 'username' | 'role' | 'disabled' | 'must_change_password'
      > & {
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

export async function getLocalPrincipal(): Promise<Principal | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return getLocalPrincipalByToken(token)
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

export const localAuthAdapter: AuthAdapter = {
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
  if (principal.mustChangePassword) {
    throw new AuthError('Password change required')
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
      SELECT id, username, role, disabled, must_change_password, created_at, updated_at
      FROM users ORDER BY username COLLATE NOCASE
    `)
    .all() as Array<{
    id: string
    username: string
    role: 'admin' | 'user'
    disabled: number
    must_change_password: number
    created_at: string
    updated_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    disabled: Boolean(row.disabled),
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export type CreateUserInput =
  | {
      mode: 'manual'
      username: string
      password: string
      role: Principal['role']
    }
  | { mode: 'temporary'; username: string; role: Principal['role'] }

/**
 * What the creator must do about credentials after a create. The
 * plaintext exists only on the temporary variant and is delivered
 * exactly once, here; nothing ever stores or returns it again (the
 * users table holds only the argon2 hash).
 */
export type CreateUserReceipt =
  | { mode: 'manual' }
  | { mode: 'temporary'; oneTimePassword: string }

export async function createLocalUser(
  input: CreateUserInput
): Promise<CreateUserReceipt> {
  await requireLocalAdmin()
  const username = input.username.trim().toLowerCase()
  if (!username) throw new QueryError('Username is required')

  const mustChange = input.mode === 'temporary'
  const password =
    input.mode === 'temporary' ? generateTemporaryPassword() : input.password
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new QueryError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  }

  const db = await getWorkbenchDatabase()
  const now = new Date().toISOString()
  const passwordHash = await hash(password)
  try {
    db.prepare(`
      INSERT INTO users
        (id, username, password_hash, role, disabled, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      username,
      passwordHash,
      input.role,
      mustChange ? 1 : 0,
      now,
      now
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new QueryError('A user with that username already exists')
    }
    throw error
  }

  return mustChange
    ? { mode: 'temporary', oneTimePassword: password }
    : { mode: 'manual' }
}

const TEMPORARY_PASSWORD_LENGTH = 16
// Lookalike-free: no I/L/O, no i/l/o, no 0/1 — temporary passwords are
// dictated or transcribed by humans, unlike session tokens.
const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function generateTemporaryPassword(): string {
  const characters: string[] = []
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index++) {
    characters.push(
      TEMPORARY_PASSWORD_ALPHABET[
        crypto.randomInt(TEMPORARY_PASSWORD_ALPHABET.length)
      ]
    )
  }
  // Four groups of four (XXXX-XXXX-XXXX-XXXX) for human transcription.
  const groups: string[] = []
  for (let offset = 0; offset < characters.length; offset += 4) {
    groups.push(characters.slice(offset, offset + 4).join(''))
  }
  return groups.join('-')
}

/**
 * Self-service change for the caller's own account. Resolves the caller
 * from the session cookie — there is no userId parameter, so the action
 * layer cannot target another account.
 */
export async function changeOwnLocalPassword(password: string): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const principal = token ? await getLocalPrincipalByToken(token) : null
  if (!principal || !token) {
    throw new AuthError('Authentication required')
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new QueryError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  }

  const db = await getWorkbenchDatabase()
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(principal.id) as { password_hash: string } | undefined
  if (!row) throw new AuthError('Authentication required')

  if (await verify(row.password_hash, password)) {
    throw new QueryError('Choose a password different from your current one')
  }

  // Hash before the transaction opens: a crash here touches nothing.
  const passwordHash = await hash(password)
  db.transaction(() => {
    // Plain UPDATE: running the change twice is an idempotent success —
    // a valid second password over an already-cleared flag.
    db.prepare(`
      UPDATE users
      SET password_hash = ?, must_change_password = 0, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, new Date().toISOString(), principal.id)
    // Revoke every OTHER session; the current one survives so the
    // post-change redirect lands inside the app.
    db.prepare(
      'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?'
    ).run(principal.id, tokenHash(token))
  })()
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

export async function setLocalUserRole(
  userId: string,
  role: Principal['role']
): Promise<void> {
  await requireLocalAdmin()
  if (role !== 'admin' && role !== 'user') {
    throw new QueryError('Invalid role')
  }
  const db = await getWorkbenchDatabase()
  const target = db
    .prepare('SELECT id, role, disabled FROM users WHERE id = ?')
    .get(userId) as Pick<UserRow, 'id' | 'role' | 'disabled'> | undefined
  if (!target) throw new QueryError('User not found')

  if (role === 'user' && target.role === 'admin' && !target.disabled) {
    const activeAdmins = db
      .prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND disabled = 0"
      )
      .get() as { count: number }
    if (activeAdmins.count <= 1) {
      throw new QueryError('The final active administrator cannot be demoted')
    }
  }

  // Sessions are not revoked: the role is read fresh from the users table on
  // every request, so the change applies on the user's next request.
  const result = db
    .prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .run(role, new Date().toISOString(), userId)
  if (result.changes === 0) throw new QueryError('User not found')
}

/**
 * Replaces the user's password with a generated temporary one, flags the
 * account for a forced change at next login and revokes all of its
 * sessions. The plaintext is returned exactly once, for the admin to
 * hand over out of band; only the hash is stored. Resetting again is the
 * recovery path when the handoff is lost: the new temporary invalidates
 * the old one.
 */
export async function resetLocalUserPassword(userId: string): Promise<string> {
  await requireLocalAdmin()
  const temporaryPassword = generateTemporaryPassword()
  const db = await getWorkbenchDatabase()
  const passwordHash = await hash(temporaryPassword)
  db.transaction(() => {
    const result = db
      .prepare(
        'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
      )
      .run(passwordHash, new Date().toISOString(), userId)
    if (result.changes === 0) throw new QueryError('User not found')
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  })()
  return temporaryPassword
}
