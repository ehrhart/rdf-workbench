'use server'

import { getWorkbenchRuntime } from '@/lib/runtime'
import type { MonitoredQueryInfo } from '@/lib/runtime/contracts'

export type MonitoredQuery = MonitoredQueryInfo

export async function getMonitoredQueries(): Promise<MonitoredQuery[]> {
  try {
    const runtime = await getWorkbenchRuntime()
    if (!runtime.queryMonitor) return []
    const caller = await runtime.auth.getPrincipal()
    if (caller?.role !== 'admin') return []
    return await runtime.queryMonitor.list(caller)
  } catch (error) {
    console.error('Error fetching monitored queries:', error)
    throw new Error("Couldn't load recent queries and updates.")
  }
}

export async function abortQuery(id?: string): Promise<void> {
  try {
    const runtime = await getWorkbenchRuntime()
    if (!runtime.queryMonitor) return
    const caller = await runtime.auth.getPrincipal()
    await runtime.queryMonitor.cancel(id ?? '', caller)
  } catch (error) {
    console.error('Error aborting query:', error)
    throw new Error("Couldn't abort the query.")
  }
}
