'use server'

import type { SessionPayload } from '@/lib/definitions'
import { AuthError, ConnectionError } from '@/lib/errors'
import { tryCatch } from '@/lib/result'
import { executeIsqlCommand } from './odbc-connection'
import { decrypt, getSessionCookie } from './session'

interface ValidatedSession {
  userId: string
  username: string
  token: string
}

const VALIDATE_ADAPTER_SESSION = true

/**
 * Gets the current session without redirecting or validating against the adapter.
 * Returns null if no valid session exists.
 * Use this for non-critical UI features that don't need strict auth.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookie = await getSessionCookie()
  const session = await decrypt(cookie)

  if (!session?.userId || new Date(session.expiresAt) < new Date()) {
    return null
  }

  return session
}

/**
 * Validates the session against both JWT and the Virtuoso adapter.
 * Returns session data or null if invalid.
 * Does NOT redirect - caller decides what to do.
 * Useful for layouts that show different content based on auth state.
 */
export async function validateSession(): Promise<ValidatedSession | null> {
  const cookie = await getSessionCookie()
  const session = await decrypt(cookie)

  // Check JWT validity
  if (!session?.userId || new Date(session.expiresAt) < new Date()) {
    return null
  }

  // Validate against the Virtuoso adapter
  if (VALIDATE_ADAPTER_SESSION) {
    const result = await tryCatch(async () =>
      executeIsqlCommand('SELECT 1 AS test', {
        authToken: session.token
      })
    )

    if (!result.success) {
      if (result.error instanceof AuthError) {
        // Bridge session is invalid
        return null
      }
      if (result.error instanceof ConnectionError) {
        // The adapter is unavailable, but JWT is valid
        // Allow user to continue - they'll see warnings on features that need the adapter
        console.warn(
          'Virtuoso adapter unavailable during session validation - allowing access with valid JWT:',
          result.error.message
        )
        // Continue to return the session below
      } else {
        // For other unexpected errors, log but allow access if JWT is valid
        console.warn(
          'Unexpected error during session validation:',
          result.error
        )
      }
    }
  }

  return {
    userId: session.userId,
    username: session.username,
    token: session.token
  }
}
