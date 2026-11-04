/**
 * Matching errors redirect to /logout from the dashboard error boundary,
 * so API response copy must never match.
 */
export function isAuthFailureCopy(error: {
  name?: string
  message?: string
}): boolean {
  const message = error?.message || ''
  return (
    error?.name === 'AuthError' ||
    message.includes('Session expired') ||
    message.includes('Your session has expired') ||
    message.toLowerCase().includes('unauthorized')
  )
}
