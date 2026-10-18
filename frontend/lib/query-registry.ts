import 'server-only'

/**
 * Owner marker for queries submitted through the anonymous public endpoint.
 * No principal id ever equals this, so ownsQuery() never matches and such
 * queries can only be cancelled by an administrator.
 */
export const PUBLIC_QUERY_OWNER = '__public_sparql__'

interface TrackedQuery {
  userId: string | null
  query: string
  startedAt: number
  abort: () => void
}

const globalStore = globalThis as typeof globalThis & {
  __workbenchQueryRegistry?: Map<string, TrackedQuery>
}

// Next.js builds each route as its own bundle, so a plain module-level Map
// exists once per bundle: the SPARQL routes and the monitor action would
// read different registries. globalThis is shared across bundles in the
// server process.
if (!globalStore.__workbenchQueryRegistry) {
  globalStore.__workbenchQueryRegistry = new Map<string, TrackedQuery>()
}
const registry = globalStore.__workbenchQueryRegistry

export function registerQuery(
  id: string,
  userId: string | null,
  query: string,
  abort: () => void
): void {
  registry.set(id, { userId, query, startedAt: Date.now(), abort })
}

export function unregisterQuery(id: string): void {
  registry.delete(id)
}

export function cancelQuery(id: string): boolean {
  const entry = registry.get(id)
  if (!entry) return false
  entry.abort()
  return true
}

export function ownsQuery(id: string, userId: string | null): boolean {
  const entry = registry.get(id)
  return Boolean(entry && entry.userId === (userId ?? null))
}

export function listQueries(): Array<TrackedQuery & { id: string }> {
  return Array.from(registry, ([id, entry]) => ({ id, ...entry }))
}
