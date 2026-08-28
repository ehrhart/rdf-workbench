import type { NextFunction, Request, Response } from 'express'
import crypto from 'node:crypto'
import { config } from '../config'
import type { VirtuosoSession } from '../session-manager'
import { getAdminSession, getSession } from '../session-manager'
import type { ErrorResponse } from '../types'

declare global {
  namespace Express {
    interface Request {
      dbSession?: VirtuosoSession
    }
  }
}

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.header('authorization') || req.header('Authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      return token
    }
  }

  const headerToken = req.header('x-session-token')
  if (headerToken && headerToken.trim().length > 0) {
    return headerToken.trim()
  }

  return null
}

export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const adapterToken = req.header('x-adapter-token')
    if (adapterToken && config.adapterToken) {
      const actual = Buffer.from(adapterToken)
      const expected = Buffer.from(config.adapterToken)
      if (
        actual.length === expected.length &&
        crypto.timingSafeEqual(actual, expected)
      ) {
        req.dbSession = getAdminSession()
        next()
        return
      }
    }

    const token = extractAuthToken(req)

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing session token'
      } as ErrorResponse)
      return
    }

    const session = getSession(token)
    req.dbSession = session
    next()
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: (error as Error).message
    } as ErrorResponse)
  }
}
