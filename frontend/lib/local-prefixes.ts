import 'server-only'

import { QueryError } from '@/lib/errors'
import type { PrefixStore } from '@/lib/runtime/contracts'
import { getWorkbenchDatabase } from '@/lib/workbench-database'
import { requireLocalAdmin } from './local-auth'

const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/

function validatePrefix(prefix: string, namespace: string) {
  const normalizedPrefix = prefix.trim()
  const normalizedNamespace = namespace.trim()
  if (!PREFIX_PATTERN.test(normalizedPrefix)) {
    throw new QueryError('Prefix must be a valid SPARQL prefix name')
  }
  try {
    new URL(normalizedNamespace)
  } catch {
    throw new QueryError('Namespace must be an absolute IRI')
  }
  return { prefix: normalizedPrefix, namespace: normalizedNamespace }
}

export async function listLocalPrefixes(): Promise<Record<string, string>> {
  const db = await getWorkbenchDatabase()
  const rows = db
    .prepare(
      'SELECT prefix, namespace FROM prefixes ORDER BY prefix COLLATE NOCASE'
    )
    .all() as Array<{ prefix: string; namespace: string }>
  return Object.fromEntries(rows.map((row) => [row.prefix, row.namespace]))
}

export const localPrefixSource: PrefixStore = {
  list: listLocalPrefixes,
  create: createLocalPrefix,
  update: updateLocalPrefix,
  delete: deleteLocalPrefix
}

export async function createLocalPrefix(
  prefix: string,
  namespace: string
): Promise<void> {
  const administrator = await requireLocalAdmin()
  const value = validatePrefix(prefix, namespace)
  const db = await getWorkbenchDatabase()
  const now = new Date().toISOString()
  try {
    db.prepare(`
      INSERT INTO prefixes
        (prefix, namespace, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(value.prefix, value.namespace, administrator.id, now, now)
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new QueryError('That prefix already exists')
    }
    throw error
  }
}

export async function updateLocalPrefix(
  oldPrefix: string,
  prefix: string,
  namespace: string
): Promise<void> {
  await requireLocalAdmin()
  const value = validatePrefix(prefix, namespace)
  const db = await getWorkbenchDatabase()
  const result = db
    .prepare(`
      UPDATE prefixes SET prefix = ?, namespace = ?, updated_at = ?
      WHERE prefix = ? COLLATE NOCASE
    `)
    .run(value.prefix, value.namespace, new Date().toISOString(), oldPrefix)
  if (result.changes === 0) throw new QueryError('Prefix not found')
}

export async function deleteLocalPrefix(prefix: string): Promise<void> {
  await requireLocalAdmin()
  const db = await getWorkbenchDatabase()
  const result = db
    .prepare('DELETE FROM prefixes WHERE prefix = ? COLLATE NOCASE')
    .run(prefix)
  if (result.changes === 0) throw new QueryError('Prefix not found')
}
