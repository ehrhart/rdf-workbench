import { cancelQuery, listQueries, ownsQuery } from '@/lib/query-registry'
import type {
  Principal,
  QueryMonitorAdapter,
  RunningQueryInfo
} from '@/lib/runtime/contracts'

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
    }
  }
}
