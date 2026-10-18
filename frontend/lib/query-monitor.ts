import 'server-only'

import { after } from 'next/server'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { cancelQuery, listQueries, ownsQuery } from '@/lib/query-registry'
import type {
  Principal,
  QueryMonitorAdapter,
  RunningQueryInfo
} from '@/lib/runtime/contracts'

function watchUrl(id: string): string {
  const url = new URL(getRuntimeConfig().SPARQL_ENDPOINT)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/watch/${encodeURIComponent(id)}`
  return url.toString()
}

// QLever keeps evaluating a query after its HTTP connection dies; the watch
// socket is the only way to stop the engine. Oxigraph and generic endpoints
// have no cancel API, so their aborts release the workbench request and the
// engine finishes on its own.
async function cancelOnEngine(id: string): Promise<void> {
  if (getRuntimeConfig().TRIPLESTORE_PROVIDER !== 'qlever') return
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const socket = new WebSocket(watchUrl(id))
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      socket.close()
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

export const registryQueryMonitor: QueryMonitorAdapter = {
  async listRunning(_caller: Principal | null): Promise<RunningQueryInfo[]> {
    const now = Date.now()
    return listQueries().map((entry) => ({
      id: entry.id,
      query: entry.query,
      lifetime: now - entry.startedAt,
      state: 'RUNNING' as const,
      cancellable: true
    }))
  },

  async cancel(id: string, caller: Principal | null): Promise<void> {
    if (caller?.role === 'admin' || ownsQuery(id, caller?.id ?? null)) {
      cancelQuery(id)
      after(() => cancelOnEngine(id))
    }
  }
}
