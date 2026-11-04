const POLL_INTERVAL_MS = 900
const MAX_POLL_ATTEMPTS = 240
const MAX_CONSECUTIVE_FAILURES = 3

const defaultSleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export interface GraphDeletionProgress {
  remaining: number
}

export interface PollUntilGraphEmptyOptions {
  uri: string
  getCount: (uri: string) => Promise<number>
  onProgress?: (progress: GraphDeletionProgress) => void
  intervalMs?: number
  maxAttempts?: number
  maxConsecutiveFailures?: number
  sleep?: (ms: number) => Promise<void>
}

export async function pollUntilGraphEmpty(
  options: PollUntilGraphEmptyOptions
): Promise<void> {
  const { uri, getCount, onProgress } = options
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS
  const maxAttempts = options.maxAttempts ?? MAX_POLL_ATTEMPTS
  const maxConsecutiveFailures =
    options.maxConsecutiveFailures ?? MAX_CONSECUTIVE_FAILURES
  const sleep = options.sleep ?? defaultSleep

  let lastError: unknown
  let consecutiveFailures = 0

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs)

    try {
      const remaining = await getCount(uri)
      consecutiveFailures = 0
      onProgress?.({ remaining })

      if (remaining === 0) return
    } catch (error) {
      lastError = error
      consecutiveFailures += 1
      console.warn(`Unable to poll triple count for graph ${uri}`, error)

      if (consecutiveFailures >= maxConsecutiveFailures) {
        throw lastError
      }
    }
  }

  throw new Error(
    `Graph deletion did not finish. ${uri} still contains data. Retry the deletion.`
  )
}
