'use server'

import { AuthError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import {
  importFile,
  importSnippet,
  importUrl
} from '@/providers/oxigraph/store'

export interface OxigraphImportResult {
  ok: boolean
  message: string
}

async function requireOxigraphAccess(): Promise<void> {
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) throw new AuthError('Authentication required')
  if (runtime.provider !== 'oxigraph') {
    throw new Error('Oxigraph import is not available for this provider')
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The import failed'
}

export async function importFileAction(
  file: File,
  format: string,
  graph?: string
): Promise<OxigraphImportResult> {
  try {
    await requireOxigraphAccess()
    const content = await file.arrayBuffer()
    await importFile(content, format, graph)
    return { ok: true, message: `Imported ${file.name}` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function importUrlAction(
  url: string,
  graph?: string
): Promise<OxigraphImportResult> {
  try {
    await requireOxigraphAccess()
    await importUrl(url, graph)
    return { ok: true, message: `Loaded ${url}` }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function importSnippetAction(
  turtle: string,
  graph?: string
): Promise<OxigraphImportResult> {
  try {
    await requireOxigraphAccess()
    await importSnippet(turtle, graph)
    return { ok: true, message: 'Snippet imported' }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}
