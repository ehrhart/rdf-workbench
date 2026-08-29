'use server'

import { AuthError, QueryError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { GraphMutations } from '@/lib/runtime/contracts'

async function mutationsWithAccess(): Promise<GraphMutations> {
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) throw new AuthError('Authentication required')
  if (!runtime.graphMutations) {
    throw new QueryError('Graph mutations are not available for this provider')
  }
  return runtime.graphMutations
}

export async function getGraphTripleCount(uri: string): Promise<number> {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.graphMutations) {
    throw new QueryError('Graph mutations are not available for this provider')
  }
  return runtime.graphMutations.getGraphTripleCount(uri)
}

export async function deleteGraph(uri: string): Promise<void> {
  const mutations = await mutationsWithAccess()
  await mutations.deleteGraph(uri)
}

export async function clearRepository(): Promise<void> {
  const mutations = await mutationsWithAccess()
  await mutations.clearRepository()
}
