import 'server-only'

import type { SparqlQueryKind } from '@/lib/runtime/contracts'

/**
 * Owner marker for queries submitted through the anonymous public endpoint.
 * No principal id ever equals this, so ownsQuery() never matches and such
 * queries can only be cancelled by an administrator.
 */
export const PUBLIC_QUERY_OWNER = '__public_sparql__'

export type FinishedQueryState =
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'

interface TrackedQuery {
  ownerId: string | null
  query: string
  kind: SparqlQueryKind
  origin: string
  startedAt: number
  abort: () => void
}

export interface FinishedQuery extends Omit<TrackedQuery, 'abort'> {
  id: string
  state: FinishedQueryState
  durationMs: number
  error?: string
}

const HISTORY_LIMIT = 200
const QUERY_TEXT_LIMIT = 4000

const globalStore = globalThis as typeof globalThis & {
  __workbenchQueryRegistry?: {
    live: Map<string, TrackedQuery>
    history: FinishedQuery[]
  }
}

// Next.js builds each route as its own bundle, so a plain module-level Map
// exists once per bundle: the SPARQL routes and the monitor action would
// read different registries. globalThis is shared across bundles in the
// server process.
if (!globalStore.__workbenchQueryRegistry) {
  globalStore.__workbenchQueryRegistry = { live: new Map(), history: [] }
}
const store = globalStore.__workbenchQueryRegistry

export function registerQuery(
  id: string,
  entry: {
    ownerId: string | null
    query: string
    kind: SparqlQueryKind
    origin: string
    abort: () => void
  }
): void {
  store.live.set(id, {
    ...entry,
    query: entry.query.slice(0, QUERY_TEXT_LIMIT),
    startedAt: Date.now()
  })
}

export function completeQuery(
  id: string,
  state: FinishedQueryState,
  error?: string
): void {
  const entry = store.live.get(id)
  if (!entry) return
  store.live.delete(id)
  store.history.push({
    id,
    ownerId: entry.ownerId,
    query: entry.query,
    kind: entry.kind,
    origin: entry.origin,
    startedAt: entry.startedAt,
    state,
    durationMs: Date.now() - entry.startedAt,
    ...(error ? { error: error.slice(0, QUERY_TEXT_LIMIT) } : {})
  })
  if (store.history.length > HISTORY_LIMIT) {
    store.history.splice(0, store.history.length - HISTORY_LIMIT)
  }
}

export function cancelQuery(id: string): boolean {
  const entry = store.live.get(id)
  if (!entry) return false
  entry.abort()
  return true
}

export function ownsQuery(id: string, userId: string | null): boolean {
  const entry = store.live.get(id)
  return Boolean(entry && entry.ownerId === (userId ?? null))
}

export function listQueries(): Array<TrackedQuery & { id: string }> {
  return Array.from(store.live, ([id, entry]) => ({ id, ...entry }))
}

export function listHistory(): FinishedQuery[] {
  return [...store.history]
}
