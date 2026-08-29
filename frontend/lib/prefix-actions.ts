'use server'

import { getWorkbenchRuntime } from '@/lib/runtime'

export async function getPrefixes(): Promise<Record<string, string>> {
  return (await getWorkbenchRuntime()).prefixes.list()
}

export async function addPrefix(
  prefix: string,
  namespace: string
): Promise<Record<string, string>> {
  await (await getWorkbenchRuntime()).prefixes.create(prefix, namespace)
  return { [prefix.trim()]: namespace.trim() }
}

export async function updatePrefix(
  oldPrefix: string,
  prefix: string,
  namespace: string
): Promise<Record<string, string>> {
  await (await getWorkbenchRuntime()).prefixes.update(
    oldPrefix,
    prefix,
    namespace
  )
  return { [prefix.trim()]: namespace.trim() }
}

export async function deletePrefix(prefix: string): Promise<void> {
  await (await getWorkbenchRuntime()).prefixes.delete(prefix)
}
