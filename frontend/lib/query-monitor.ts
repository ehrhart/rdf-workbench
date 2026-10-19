import 'server-only'

import { after } from 'next/server'
import {
  cancelQuery,
  completeQuery,
  listHistory,
  listQueries,
  ownsQuery,
  registerQuery
} from '@/lib/query-registry'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  MonitoredQueryInfo,
  Principal,
  QueryMonitorAdapter,
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { detectQueryKind } from '@/lib/sparql/kind'

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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function withQueryMonitoring(
  transport: SparqlTransport,
  defaultOrigin: string
): SparqlTransport {
  async function track<T>(
    query: string,
    options: SparqlRequestOptions | undefined,
    run: (options: SparqlRequestOptions) => Promise<T>
  ): Promise<T> {
    const id = crypto.randomUUID()
    const controller = new AbortController()
    const { signal, ...rest } = options ?? {}
    const kind = rest.kind ?? detectQueryKind(query)
    registerQuery(id, {
      ownerId: rest.ownerId ?? null,
      query,
      kind,
      origin: rest.origin ?? defaultOrigin,
      abort: () => controller.abort()
    })
    const trackedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal
    try {
      const result = await run({ ...rest, signal: trackedSignal, queryId: id })
      completeQuery(id, 'COMPLETED')
      return result
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        completeQuery(id, 'CANCELLED')
      } else if (error instanceof SparqlTimeoutError) {
        completeQuery(id, 'TIMEOUT')
      } else {
        completeQuery(
          id,
          'FAILED',
          error instanceof Error ? error.message : String(error)
        )
      }
      throw error
    }
  }

  return {
    execute(query, options) {
      return track(query, options, (opts) => transport.execute(query, opts))
    },
    download(query, format, options) {
      return track(query, options, (opts) =>
        transport.download(query, format, opts)
      )
    },
    getDownloadFormats(kind) {
      return transport.getDownloadFormats(kind)
    }
  }
}

export const registryQueryMonitor: QueryMonitorAdapter = {
  async list(_caller: Principal | null): Promise<MonitoredQueryInfo[]> {
    const now = Date.now()
    const running = listQueries().map((entry) => ({
      id: entry.id,
      query: entry.query,
      kind: entry.kind,
      origin: entry.origin,
      ownerId: entry.ownerId,
      startedAt: entry.startedAt,
      lifetime: now - entry.startedAt,
      state: 'RUNNING' as const,
      cancellable: true
    }))
    const finished = listHistory().map((entry) => ({
      id: entry.id,
      query: entry.query,
      kind: entry.kind,
      origin: entry.origin,
      ownerId: entry.ownerId,
      startedAt: entry.startedAt,
      lifetime: entry.durationMs,
      state: entry.state,
      durationMs: entry.durationMs,
      error: entry.error,
      cancellable: false
    }))
    return [...running, ...finished]
  },

  async cancel(id: string, caller: Principal | null): Promise<void> {
    if (caller?.role === 'admin' || ownsQuery(id, caller?.id ?? null)) {
      cancelQuery(id)
      after(() => cancelOnEngine(id))
    }
  }
}
