'use server'

import { getWorkbenchRuntime } from '@/lib/runtime'
import type { RunningQueryInfo } from '@/lib/runtime/contracts'

export type RunningQuery = RunningQueryInfo

/**
 * Fetches all currently running queries from the configured triplestore.
 * @returns An array of running query objects
 */
export async function getRunningQueries(): Promise<RunningQuery[]> {
  try {
    const runtime = await getWorkbenchRuntime()
    if (!runtime.queryMonitor) return []
    const caller = await runtime.auth.getPrincipal()
    return await runtime.queryMonitor.listRunning(caller)
  } catch (error) {
    console.error('Error fetching running queries:', error)
    throw new Error('Failed to fetch running queries')
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
    throw new Error('Failed to abort query')
  }
}
