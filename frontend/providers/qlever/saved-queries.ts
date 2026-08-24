import 'server-only'

import crypto from 'node:crypto'
import { AuthError, QueryError } from '@/lib/errors'
import type {
  Principal,
  SavedQueryInput,
  SavedQueryRepository
} from '@/lib/runtime/contracts'
import type { SavedQuery } from '@/types'
import { getQleverDatabase } from './database'

interface SavedQueryRow {
  id: string
  name: string
  query_text: string
  owner_id: string
  owner_username: string
  created_at: string
  updated_at: string
  position: number
}

function mapSavedQuery(
  row: SavedQueryRow,
  viewerId?: string | null
): SavedQuery {
  return {
    id: row.id,
    name: row.name,
    query: row.query_text,
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    position: Number(row.position ?? 0),
    isOwner: Boolean(viewerId && viewerId === row.owner_id)
  }
}

function validateInput(input: SavedQueryInput): SavedQueryInput {
  const name = input.name.trim().slice(0, 255)
  const query = input.query.trim()
  if (!name) throw new QueryError('A name is required to save a query')
  if (!query) throw new QueryError('Cannot save an empty query')
  return { name, query }
}

async function getSavedQuery(
  id: string,
  viewerId?: string | null
): Promise<SavedQuery | null> {
  const db = await getQleverDatabase()
  const row = db.prepare('SELECT * FROM saved_queries WHERE id = ?').get(id) as
    | SavedQueryRow
    | undefined
  return row ? mapSavedQuery(row, viewerId) : null
}

const canManage = (existing: SavedQuery, owner: Principal): boolean =>
  existing.ownerId === owner.id || owner.role === 'admin'

export const qleverSavedQueryRepository: SavedQueryRepository = {
  async list(viewerId) {
    const db = await getQleverDatabase()
    const rows = db
      .prepare(
        'SELECT * FROM saved_queries ORDER BY position ASC, updated_at DESC'
      )
      .all() as SavedQueryRow[]
    return rows.map((row) => mapSavedQuery(row, viewerId))
  },

  get: getSavedQuery,

  async create(input, owner) {
    if (!owner) throw new AuthError('Authentication required to save queries')
    const value = validateInput(input)
    const db = await getQleverDatabase()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const nextPosition = db
      .prepare(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM saved_queries'
      )
      .get() as { next: number }
    db.prepare(`
      INSERT INTO saved_queries
        (id, name, query_text, owner_id, owner_username, created_at, updated_at, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      value.name,
      value.query,
      owner.id,
      owner.username,
      now,
      now,
      nextPosition.next
    )
    const created = await getSavedQuery(id, owner.id)
    if (!created) throw new QueryError('Failed to persist saved query')
    return created
  },

  async update(id, input, owner) {
    if (!owner) throw new AuthError('Authentication required to update queries')
    const existing = await getSavedQuery(id, owner.id)
    if (!existing) throw new QueryError('Saved query not found')
    if (!canManage(existing, owner)) {
      throw new AuthError('You do not own this saved query')
    }
    const value = validateInput(input)
    const db = await getQleverDatabase()
    db.prepare(`
      UPDATE saved_queries
      SET name = ?, query_text = ?, updated_at = ?
      WHERE id = ?
    `).run(value.name, value.query, new Date().toISOString(), id)
    const updated = await getSavedQuery(id, owner.id)
    if (!updated) throw new QueryError('Failed to update saved query')
    return updated
  },

  async delete(id, owner) {
    if (!owner) throw new AuthError('Authentication required to delete queries')
    const existing = await getSavedQuery(id, owner.id)
    if (!existing) throw new QueryError('Saved query not found')
    if (!canManage(existing, owner)) {
      throw new AuthError('You do not own this saved query')
    }
    const db = await getQleverDatabase()
    db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id)
  },

  async reorder(order, owner) {
    if (!owner)
      throw new AuthError('Authentication required to reorder queries')
    if (owner.role !== 'admin') {
      throw new AuthError('Only administrators can reorder saved queries')
    }
    const db = await getQleverDatabase()
    const update = db.prepare(
      'UPDATE saved_queries SET position = ? WHERE id = ?'
    )
    db.transaction(() => {
      for (const item of order) {
        const position = Number.isFinite(item.position)
          ? Math.trunc(item.position)
          : 0
        update.run(position, item.id)
      }
    })()
  }
}
