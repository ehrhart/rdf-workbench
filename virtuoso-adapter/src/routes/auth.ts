import type { Request, Response } from 'express'
import { logger } from '../logger'
import { extractAuthToken } from '../middleware/auth'
import { createUserSession, destroySession } from '../session-manager'
import type { ErrorResponse, LoginRequest } from '../types'

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as LoginRequest

  if (!username || !password) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Username and password are required'
    } as ErrorResponse)
    return
  }

  try {
    const result = await createUserSession(username, password)
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
