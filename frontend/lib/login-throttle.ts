import 'server-only'

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000

interface Attempt {
  count: number
  windowStart: number
}

const failures = new Map<string, Attempt>()

export function loginThrottleKey(username: string, ip: string): string {
  return `${ip}|${username.trim().toLowerCase()}`
}

export function isLoginBlocked(key: string): boolean {
  const attempt = failures.get(key)
  if (!attempt) return false
  if (Date.now() - attempt.windowStart > WINDOW_MS) {
    failures.delete(key)
    return false
  }
  return attempt.count >= MAX_FAILURES
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const attempt = failures.get(key)
  if (!attempt || now - attempt.windowStart > WINDOW_MS) {
    failures.set(key, { count: 1, windowStart: now })
    return
  }
  attempt.count += 1
}

export function recordLoginSuccess(key: string): void {
  failures.delete(key)
}
