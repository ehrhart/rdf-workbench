import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  Principal,
  QueryMonitorAdapter,
  RunningQueryInfo
} from '@/lib/runtime/contracts'
import { ownsQuery } from './query-registry'

function config() {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'qlever') {
    throw new Error('QLever query monitor requested in a Virtuoso deployment')
  }
  return value
}

function watchUrl(id: string): string {
  const url = new URL(config().SPARQL_ENDPOINT)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${url.origin}/watch/${encodeURIComponent(id)}`
}

interface ActiveQueryEntry {
  query?: string
  'started-at'?: number
}

async function listServerWide(): Promise<RunningQueryInfo[]> {
  const { SPARQL_ENDPOINT, QLEVER_ACCESS_TOKEN } = config()
  if (!QLEVER_ACCESS_TOKEN) return []
  const response = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      cmd: 'dump-active-queries',
      'access-token': QLEVER_ACCESS_TOKEN
    }),
    cache: 'no-store'
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      body || `QLever failed to list running queries (${response.status})`
    )
  }
  const payload = (await response.json()) as Record<string, ActiveQueryEntry>
  const now = Date.now()
  return Object.entries(payload).map(([id, entry]) => ({
    id,
    query: entry.query ?? '',
    lifetime: now - (entry['started-at'] ?? now),
    state: 'RUNNING' as const
  }))
}

async function cancelQuery(id: string): Promise<void> {
  if (!id) return
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const socket = new WebSocket(watchUrl(id))
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {
        // Socket may already be closed.
      }
      if (error) reject(error)
      else resolve()
    }
    const timeout = setTimeout(
      () => finish(new Error('Timed out cancelling QLever query')),
      10_000
    )
    socket.onopen = () => {
      socket.send('cancel')
      setTimeout(() => {
        clearTimeout(timeout)
        finish()
      }, 250)
    }
    socket.onerror = () => {
      clearTimeout(timeout)
      finish(new Error('Failed to open QLever watch socket'))
    }
  })
}

export const qleverQueryMonitor: QueryMonitorAdapter = {
  async listRunning(caller: Principal | null): Promise<RunningQueryInfo[]> {
    if (caller?.role !== 'admin') return []
    return listServerWide()
  },

  async cancel(id: string, caller: Principal | null): Promise<void> {
    if (caller?.role === 'admin') {
      await cancelQuery(id)
      return
    }
    if (ownsQuery(id, caller?.id ?? null)) {
      await cancelQuery(id)
    }
  }
}
