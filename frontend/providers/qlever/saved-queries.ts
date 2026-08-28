import 'server-only'

import crypto from 'node:crypto'
import { AuthError, QueryError } from '@/lib/errors'
import type {
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

export const qleverSavedQueryRepository: SavedQueryRepository = {
  async list(viewerId) {
    const db = await getQleverDatabase()
    const rows = db
      .prepare('SELECT * FROM saved_queries ORDER BY updated_at DESC')
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
    db.prepare(`
      INSERT INTO saved_queries
        (id, name, query_text, owner_id, owner_username, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, value.name, value.query, owner.id, owner.username, now, now)
    const created = await getSavedQuery(id, owner.id)
    if (!created) throw new QueryError('Failed to persist saved query')
    return created
  },

  async update(id, input, owner) {
    if (!owner) throw new AuthError('Authentication required to update queries')
    const existing = await getSavedQuery(id, owner.id)
    if (!existing) throw new QueryError('Saved query not found')
    if (existing.ownerId !== owner.id) {
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
    if (existing.ownerId !== owner.id) {
      throw new AuthError('You do not own this saved query')
    }
    const db = await getQleverDatabase()
    db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id)
  }
}
