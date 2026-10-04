import type { NextFunction, Request, Response } from 'express'
import crypto from 'node:crypto'
import { config } from '../config'
import type { ErrorResponse } from '../types'

export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adapterToken = req.header('x-adapter-token')
  if (!adapterToken || !config.adapterToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing adapter token'
    } as ErrorResponse)
    return
  }

  const actual = Buffer.from(adapterToken)
  const expected = Buffer.from(config.adapterToken)
  const matches =
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)

  if (!matches) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid adapter token'
    } as ErrorResponse)
    return
  }

  next()
}
