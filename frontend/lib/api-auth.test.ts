import { describe, expect, it } from 'vitest'
import {
  passwordChangeRequiredResponse,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from './api-auth'
import { isAuthFailureCopy } from './auth-error-copy'

describe('api-auth response copy', () => {
  it.each([
    ['unauthenticatedResponse', unauthenticatedResponse],
    ['passwordChangeRequiredResponse', passwordChangeRequiredResponse],
    ['serviceUnavailableResponse', serviceUnavailableResponse]
  ] as const)(
    '%s never reads as an auth failure to the dashboard error boundary',
    async (_name, build) => {
      const body = (await build().json()) as { error: string }
      expect(isAuthFailureCopy({ message: body.error })).toBe(false)
    }
  )

  it('flags the copy the boundary must bounce to /logout', () => {
    expect(isAuthFailureCopy({ name: 'AuthError', message: '' })).toBe(true)
    expect(isAuthFailureCopy({ message: 'Session expired' })).toBe(true)
    expect(isAuthFailureCopy({ message: 'Your session has expired' })).toBe(
      true
    )
    expect(isAuthFailureCopy({ message: 'Unauthorized access' })).toBe(true)
  })
})
