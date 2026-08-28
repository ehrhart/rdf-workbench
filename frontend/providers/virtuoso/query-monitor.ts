import 'server-only'

import shortHash from 'short-hash'
import type {
  Principal,
  QueryMonitorAdapter,
  RunningQueryInfo
} from '@/lib/runtime/contracts'
import { executeIsqlCommand } from './odbc-connection'

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
    return parseStatusOutput(rawQueries).map((query) => ({
      id: shortHash(query.query),
      query: query.query,
      lifetime: query.time,
      state: 'RUNNING' as const
    }))
  },

  async cancel(_id: string, caller: Principal | null): Promise<void> {
    if (!caller) return
    await executeIsqlCommand('txn_killall(6)', {
      useServiceCredentials: true
    })
  }
}
