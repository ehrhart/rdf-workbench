import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import type { SessionPayload } from '@/lib/definitions'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'

const SESSION_COOKIE_NAME = 'session'

/**
 * Get session from request (for use in Route Handlers).
 * This is used when we need to extract the session from a NextRequest object.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const secretKey = getVirtuosoConfig().SESSION_SECRET
  if (!secretKey) {
    console.error('SESSION_SECRET environment variable is required')
    return null
  }

  const encodedKey = new TextEncoder().encode(secretKey)
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!cookie) {
    return null
  }

  try {
    const { payload } = await jwtVerify(cookie, encodedKey, {
      algorithms: ['HS256']
    })

    const expiresAt = new Date(payload.expiresAt as string)

    // Check if session is expired
    if (expiresAt < new Date()) {
      return null
    }

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      token: payload.token as string,
      expiresAt
    }
  } catch {
    return null
  }
}
