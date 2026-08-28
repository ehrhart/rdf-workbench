import 'server-only'

import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import type { SessionPayload } from '@/lib/definitions'
import { getRuntimeConfig } from '@/lib/runtime/config'

const SESSION_COOKIE_NAME = 'session'
const SESSION_DURATION_DAYS = 7

function getEncodedKey(): Uint8Array {
  const config = getRuntimeConfig()
  if (config.TRIPLESTORE_PROVIDER !== 'virtuoso' || !config.SESSION_SECRET) {
    throw new Error('Virtuoso SESSION_SECRET is unavailable')
  }
  return new TextEncoder().encode(config.SESSION_SECRET)
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    token: payload.token,
    expiresAt: payload.expiresAt.toISOString()
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getEncodedKey())
}

export async function decrypt(
  session: string | undefined = ''
): Promise<SessionPayload | null> {
  if (!session) {
    return null
  }

  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ['HS256']
    })

    // Reconstruct the SessionPayload from JWT claims
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      token: payload.token as string,
      expiresAt: new Date(payload.expiresAt as string)
    }
  } catch (error) {
    console.error('Failed to verify session:', error)
    return null
  }
}

export async function createSession(
  userId: string,
  username: string,
  token: string
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  )

  const session = await encrypt({
    userId,
    username,
    token,
    expiresAt
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: getRuntimeConfig().NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/'
  })
}

export async function updateSession(): Promise<void> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const payload = await decrypt(session)

  if (!session || !payload) {
    return
  }

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  )

  // Re-encrypt with updated expiration
  const newSession = await encrypt({
    ...payload,
    expiresAt
  })

  cookieStore.set(SESSION_COOKIE_NAME, newSession, {
    httpOnly: true,
    secure: getRuntimeConfig().NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/'
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

export async function getAuthTokenFromCookie(): Promise<string | null> {
  const cookie = await getSessionCookie()
  const session = await decrypt(cookie)

  if (!session?.userId || new Date(session.expiresAt) < new Date()) {
    return null
  }

  return session.token
}
