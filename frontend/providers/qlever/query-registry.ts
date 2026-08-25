import 'server-only'

export interface RegisteredQuery {
  userId: string | null
  query: string
  startedAt: number
}

/**
 * Owner marker for queries submitted through the anonymous public endpoint.
 * No caller id ever equals this, so ownsQuery() never matches and such queries
 * can only be cancelled by an administrator.
 */
export const PUBLIC_QUERY_OWNER = '__public_sparql__'

const registry = new Map<string, RegisteredQuery>()

export function registerQuery(
  queryId: string,
  userId: string | null,
  query: string
): void {
  registry.set(queryId, { userId, query, startedAt: Date.now() })
}

export function unregisterQuery(queryId: string): void {
  registry.delete(queryId)
}

export function ownsQuery(queryId: string, userId: string | null): boolean {
  const entry = registry.get(queryId)
  return Boolean(entry && entry.userId === (userId ?? null))
}
