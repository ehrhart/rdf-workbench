import 'server-only'

interface Window {
  count: number
  startedAt: number
}

const windows = new Map<string, Window>()
const MAX_TRACKED_KEYS = 10_000

export function isRateLimited(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const window = windows.get(key)
  if (!window || now - window.startedAt > windowMs) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [existing, value] of windows) {
        if (now - value.startedAt > windowMs) {
          windows.delete(existing)
        }
      }
    }
    windows.set(key, { count: 1, startedAt: now })
    return false
  }
  if (window.count >= max) return true
  window.count += 1
  return false
}
