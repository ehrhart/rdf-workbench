'use server'

import { AuthError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { importUrl } from '@/providers/generic/import'

export interface GenericImportResult {
  ok: boolean
  message: string
}

async function requireGenericAccess(): Promise<void> {
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) throw new AuthError('Authentication required')
  if (runtime.provider !== 'generic') {
    throw new Error('Generic import is not available for this provider')
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The import failed'
}

export async function importUrlAction(
  url: string,
  graph?: string
): Promise<GenericImportResult> {
  try {
    await requireGenericAccess()
    await importUrl(url, graph)
    return { ok: true, message: `Loaded ${url}` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}
