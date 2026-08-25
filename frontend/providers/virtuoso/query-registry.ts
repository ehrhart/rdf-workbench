import 'server-only'

export const PUBLIC_QUERY_OWNER = '__public_sparql__'

interface RegisteredVirtuosoQuery {
  userId: string | null
  query: string
  startedAt: number
  abort: () => void
}

const registry = new Map<string, RegisteredVirtuosoQuery>()

function normalizeQuery(query: string): string {
  return query.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
}

export function registerQuery(
  queryId: string,
  userId: string | null,
  query: string,
  abort: () => void
): void {
  registry.set(queryId, {
    userId,
    query: normalizeQuery(query),
    startedAt: Date.now(),
    abort
  })
}

export function unregisterQuery(queryId: string): void {
  registry.delete(queryId)
}

export function cancelQuery(queryId: string): boolean {
  const entry = registry.get(queryId)
  if (!entry) return false
  entry.abort()
  return true
}

export function findQueryIdByQuery(query: string): string | undefined {
  const normalized = normalizeQuery(query)
  for (const [queryId, entry] of registry) {
    if (entry.query === normalized) return queryId
  }
  return undefined
}

export function ownsQuery(queryId: string, userId: string | null): boolean {
  const entry = registry.get(queryId)
  return Boolean(entry && entry.userId === (userId ?? null))
}
