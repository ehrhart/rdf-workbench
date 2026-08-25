import 'server-only'

import { AuthError, ConnectionError } from '@/lib/errors'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  AuthAdapter,
  LoginCredentials,
  Principal
} from '@/lib/runtime/contracts'
import { createSession, deleteSession, getAuthTokenFromCookie } from './session'
import { validateSession } from './session-validation'

function config() {
  const runtime = getRuntimeConfig()
  if (runtime.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new Error('Virtuoso authentication requested in a QLever deployment')
  }
  return runtime
}

export async function loginVirtuosoUser(
  credentials: LoginCredentials
): Promise<Principal> {
  let response: Response
  try {
    response = await fetch(`${config().VIRTUOSO_ADAPTER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username.trim().toLowerCase(),
        password: credentials.password
      })
    })
  } catch {
    throw new ConnectionError('Unable to reach the Virtuoso adapter')
  }

  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.token || !body?.user) {
    throw new AuthError(
      body?.message || body?.error || 'Invalid username or password'
    )
  }

  const principal: Principal = {
    id: String(body.user.id),
    username: String(body.user.username),
    role: 'admin'
  }
  await createSession(principal.id, principal.username, String(body.token))
  return principal
}

export async function getVirtuosoPrincipal(): Promise<Principal | null> {
  const session = await validateSession()
  if (!session) return null
  return {
    id: session.userId,
    username: session.username,
    role: 'admin'
  }
}

export async function logoutVirtuosoUser(): Promise<void> {
  const token = await getAuthTokenFromCookie()
  if (token) {
    await fetch(`${config().VIRTUOSO_ADAPTER_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => undefined)
  }
  await deleteSession()
}

export async function requireVirtuosoRole(
  role: Principal['role']
): Promise<Principal> {
  const principal = await getVirtuosoPrincipal()
  if (!principal || principal.role !== role) {
    throw new AuthError(
      `${role === 'admin' ? 'Administrator' : 'User'} access required`
    )
  }
  return principal
}

export const virtuosoAuthAdapter: AuthAdapter = {
  login: loginVirtuosoUser,
  getPrincipal: getVirtuosoPrincipal,
  logout: logoutVirtuosoUser,
  requireRole: requireVirtuosoRole
}
