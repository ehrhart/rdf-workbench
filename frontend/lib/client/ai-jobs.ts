'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiJobDto, AiJobKind } from '@/lib/ai/ask-contract'

const START_URLS: Record<AiJobKind, string> = {
  explore: '/api/admin/ai/explore-graph',
  profile: '/api/ask/profile'
}

const POLL_INTERVAL_MS = 3000

export interface UseAiJobsResult {
  job: AiJobDto | null
  /** True while this kind has a running job. */
  running: boolean
  /** Seconds elapsed since the running job started; 0 when idle. */
  elapsedSeconds: number
  start: () => Promise<{ ok: boolean; error?: string }>
  cancel: () => Promise<void>
}

/**
 * Client state for one background AI job kind: starts it, polls while it
 * runs and exposes the finished result. Seeded from the server render so
 * revisiting the page restores a running state.
 */
export function useAiJobs(
  kind: AiJobKind,
  initialJob: AiJobDto | null
): UseAiJobsResult {
  const [job, setJob] = useState<AiJobDto | null>(initialJob)
  const running = job?.status === 'running'
  const startedAt = running ? (job?.startedAt ?? null) : null
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsedSeconds(0)
      return
    }
    const tick = () =>
      setElapsedSeconds(
        Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 1000))
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/ai/jobs')
      if (!response.ok) return
      const payload = (await response.json()) as Record<
        AiJobKind,
        AiJobDto | null
      >
      setJob(payload[kind])
    } catch {
      // Transient network failures keep the last known state; the next
      // poll retries.
    }
  }, [kind])

  useEffect(() => {
    if (!running) return
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [running, refresh])

  const start = useCallback(async () => {
    try {
      const response = await fetch(START_URLS[kind], { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as {
        job?: AiJobDto
        error?: string
      } | null
      if (payload?.job) {
        setJob(payload.job)
        return {
          ok: response.ok,
          error: response.ok ? undefined : payload.error
        }
      }
      return { ok: false, error: payload?.error ?? 'Failed to start the job' }
    } catch {
      return { ok: false, error: 'Failed to start the job' }
    }
  }, [kind])

  const cancel = useCallback(async () => {
    await fetch(`/api/admin/ai/jobs?kind=${kind}`, { method: 'DELETE' }).catch(
      () => null
    )
    await refresh()
  }, [kind, refresh])

  return { job, running, elapsedSeconds, start, cancel }
}

/**
 * Fires once when the polled job leaves the running state, so callers can
 * toast and apply results without re-firing on later renders. The effect
 * re-runs on every poll (fresh job identity) but the ref guard keeps the
 * callback to one call per transition.
 */
export function useJobCompletion(
  job: AiJobDto | null,
  onComplete: (job: AiJobDto) => void
): void {
  const previousStatus = useRef<string | undefined>(job?.status)
  useEffect(() => {
    const before = previousStatus.current
    previousStatus.current = job?.status
    if (before === 'running' && job && job.status !== 'running') {
      onComplete(job)
    }
  }, [job, onComplete])
}
