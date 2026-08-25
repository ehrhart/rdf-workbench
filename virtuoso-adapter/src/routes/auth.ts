import type { Request, Response } from 'express'
import { logger } from '../logger'
import { extractAuthToken } from '../middleware/auth'
import { createUserSession, destroySession } from '../session-manager'
import type { ErrorResponse, LoginRequest } from '../types'

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

interface LoginAttempt {
  count: number
  firstAttempt: number
  blockedUntil: number
}

const attempts = new Map<string, LoginAttempt>()

function loginKey(username: string): string {
  return username.trim().toLowerCase()
}

function checkRateLimit(key: string): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  const now = Date.now()
  const record = attempts.get(key)
  if (!record) return { allowed: true }
  if (record.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000)
    }
  }
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key)
    return { allowed: true }
  }
  return { allowed: true }
}

function recordFailure(key: string): void {
  const now = Date.now()
  const record =
    attempts.get(key) ?? { count: 0, firstAttempt: now, blockedUntil: 0 }
  if (now - record.firstAttempt > WINDOW_MS) {
    record.count = 0
    record.firstAttempt = now
  }
  record.count += 1
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS
    logger.warn('Login temporarily blocked after repeated failures', { key })
  }
  attempts.set(key, record)
}

function recordSuccess(key: string): void {
  attempts.delete(key)
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as LoginRequest

  if (!username || !password) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Username and password are required'
    } as ErrorResponse)
    return
  }

  const key = loginKey(username)
  const rate = checkRateLimit(key)
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfterSeconds ?? 60))
    res.status(429).json({
      error: 'Too many attempts',
      message: 'Too many failed login attempts. Try again later.'
    } as ErrorResponse)
    return
  }

  try {
    const result = await createUserSession(username, password)
    recordSuccess(key)
    res.json(result)
  } catch (error) {
    const err = error as any
    logger.error('Failed to authenticate user via Virtuoso', {
      error: err.message,
      odbcErrors: err.odbcErrors,
      stack: err.stack,
      username
    })

    const odbcErrors = err.odbcErrors as
      | Array<{ state: string; message: string; code: number }>
      | undefined
    const isCredentialIssue =
      odbcErrors?.some((e) => e.state === '28000') ?? false

    if (isCredentialIssue) {
      recordFailure(key)
    }

    res.status(isCredentialIssue ? 401 : 503).json({
      error: 'Authentication failed',
      message: isCredentialIssue
        ? 'Invalid username or password'
        : 'Unable to establish a connection to Virtuoso'
    } as ErrorResponse)
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = extractAuthToken(req)
  if (!token) {
    res.status(204).end()
    return
  }

  try {
    await destroySession(token)
    res.status(204).end()
  } catch (error) {
    logger.warn('Failed to terminate Virtuoso session on logout', {
      error: (error as Error).message
    })
    res.status(500).json({
      error: 'Logout failed',
      message: 'Unable to terminate session'
    } as ErrorResponse)
  }
}
