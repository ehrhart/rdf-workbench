'use server'

import { getWorkbenchRuntime } from '@/lib/runtime'

export async function getPrefixes(): Promise<Record<string, string>> {
  return (await getWorkbenchRuntime()).prefixes.list()
}

export async function addPrefix(
  prefix: string,
  namespace: string
): Promise<Record<string, string>> {
  const runtime = await getWorkbenchRuntime()
  if (runtime.provider === 'virtuoso') {
    return (await import('@/providers/virtuoso/capabilities')).addPrefix(
      prefix,
      namespace
    )
  }

  await (await import('@/providers/qlever/prefixes')).createQleverPrefix(
    prefix,
    namespace
  )
  return { [prefix.trim()]: namespace.trim() }
}

export async function updatePrefix(
  oldPrefix: string,
  prefix: string,
  namespace: string
): Promise<Record<string, string>> {
  const runtime = await getWorkbenchRuntime()
  if (runtime.provider === 'virtuoso') {
    return (await import('@/providers/virtuoso/capabilities')).updatePrefix(
      oldPrefix,
      prefix,
      namespace
    )
  }

  await (await import('@/providers/qlever/prefixes')).updateQleverPrefix(
    oldPrefix,
    prefix,
    namespace
  )
  return { [prefix.trim()]: namespace.trim() }
}

export async function deletePrefix(prefix: string): Promise<void> {
  const runtime = await getWorkbenchRuntime()
  if (runtime.provider === 'virtuoso') {
    return (await import('@/providers/virtuoso/capabilities')).deletePrefix(
      prefix
    )
  }

  return (await import('@/providers/qlever/prefixes')).deleteQleverPrefix(
    prefix
  )
}
