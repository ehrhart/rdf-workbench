import 'server-only'

import shortHash from 'short-hash'
import type {
  Principal,
  QueryMonitorAdapter,
  RunningQueryInfo
} from '@/lib/runtime/contracts'
import { executeIsqlCommand } from './odbc-connection'
import { cancelQuery, findQueryIdByQuery } from './query-registry'

interface ParsedQuery {
  time: number
  query: string
}

function parseStatusOutput(rawQueries: { REPORT: string }[]): ParsedQuery[] {
  const output: ParsedQuery[] = []
  let current: ParsedQuery | null = null

  for (const { REPORT } of rawQueries) {
    const match = REPORT.match(/^(\d+)\s+(SPARQL\s+.+)/i)
    if (match) {
      if (current) {
        output.push({
          time: current.time,
          query: current.query.trim().replace(/\r?\n/g, '\\n')
        })
      }
      current = {
        time: parseInt(match[1], 10),
        query: match[2]
      }
    } else if (current) {
      current.query += REPORT
    }
  }

  if (current) {
    output.push({
      time: current.time,
      query: current.query.trim().replace(/\r?\n/g, '\\n')
    })
  }

  return output
}

export const virtuosoQueryMonitor: QueryMonitorAdapter = {
  async listRunning(caller: Principal | null): Promise<RunningQueryInfo[]> {
    if (!caller) return []
    const rawQueries = await executeIsqlCommand<{ REPORT: string }[]>(
      "status('exec')",
      { useServiceCredentials: true }
    )
    return parseStatusOutput(rawQueries).map((query) => {
      const registeredId = findQueryIdByQuery(query.query)
      return {
        id: registeredId ?? shortHash(query.query),
        query: query.query,
        lifetime: query.time,
        state: 'RUNNING' as const,
        cancellable: Boolean(registeredId)
      }
    })
  },

  async cancel(id: string, caller: Principal | null): Promise<void> {
    if (!caller) return
    // Virtuoso treats a cancelled HTTP request as a query cancellation, so
    // abort the request that is executing this query. Queries that were not
    // submitted through the workbench (e.g. anonymous /sparql requests)
    // have no tracked request and cannot be cancelled.
    cancelQuery(id)
  }
}
