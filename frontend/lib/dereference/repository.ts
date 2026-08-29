import 'server-only'

import { validateDereferencePathFormat } from '@/lib/dereference/rules'
import { QueryError } from '@/lib/errors'
import type { DereferenceRepository } from '@/lib/runtime/contracts'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

export const dereferenceRepository: DereferenceRepository = {
  async list() {
    const db = await getWorkbenchDatabase()
    const rows = db
      .prepare(
        'SELECT path FROM dereference_paths ORDER BY path COLLATE NOCASE'
      )
      .all() as Array<{ path: string }>
    return rows.map((row) => ({ path: row.path }))
  },

  async create(rawPath) {
    const path = validateDereferencePathFormat(rawPath)
    const db = await getWorkbenchDatabase()
    const now = new Date().toISOString()
    try {
      db.prepare(`
        INSERT INTO dereference_paths (path, created_at, updated_at)
        VALUES (?, ?, ?)
      `).run(path, now, now)
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new QueryError(`Path "/${path}" is already configured`)
      }
      throw error
    }
  },

  async rename(oldRawPath, newRawPath) {
    const oldPath = oldRawPath.trim()
    const newPath = validateDereferencePathFormat(newRawPath)
    const db = await getWorkbenchDatabase()
    const result = db
      .prepare(
        'UPDATE dereference_paths SET path = ?, updated_at = ? WHERE path = ?'
      )
      .run(newPath, new Date().toISOString(), oldPath)
    if (result.changes === 0) {
      throw new QueryError(`Path "/${oldPath}" is not configured`)
    }
  },

  async remove(rawPath) {
    const path = rawPath.trim()
    const db = await getWorkbenchDatabase()
    const result = db
      .prepare('DELETE FROM dereference_paths WHERE path = ?')
      .run(path)
    if (result.changes === 0) {
      throw new QueryError(`Path "/${path}" is not configured`)
    }
  }
}
