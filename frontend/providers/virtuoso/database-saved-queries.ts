'use server'

import crypto from 'node:crypto'

import { AuthError, QueryError } from '@/lib/errors'
import type { SavedQuery } from '@/types'
import { executeIsqlCommand, executeIsqlWithAuth } from './odbc-connection'

interface SavedQueryRow {
  ID?: string
  NAME?: string
  QUERY_TEXT?: string
  OWNER_ID?: string
  OWNER_USERNAME?: string
  CREATED_AT?: string | Date
  UPDATED_AT?: string | Date
}

const TABLE_NAME = 'DB.DBA.VRM_SAVED_QUERIES'
const OWNER_INDEX = 'VRM_SAVED_QUERIES_OWNER_IDX'
const UPDATED_INDEX = 'VRM_SAVED_QUERIES_UPDATED_IDX'

const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")

const normalizeDate = (value: string | Date | undefined): string => {
  if (!value) return new Date().toISOString()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

const mapRowToSavedQuery = (
  row: SavedQueryRow,
  currentUserId?: string | null
): SavedQuery => {
  const id = row.ID ?? ''
  const name = row.NAME ?? 'Saved Query'
  const query = row.QUERY_TEXT ?? ''
  const ownerId = row.OWNER_ID ?? ''
  const ownerUsername = row.OWNER_USERNAME ?? 'unknown'

  return {
    id,
    name,
    query,
    ownerId,
    ownerUsername,
    createdAt: normalizeDate(row.CREATED_AT),
    updatedAt: normalizeDate(row.UPDATED_AT),
    isOwner: Boolean(currentUserId && ownerId === currentUserId)
  }
}

async function ensureTableExists(): Promise<void> {
  const exists = await executeIsqlCommand<Array<{ TABLE_EXISTS: number }>>(
    "SELECT 1 AS TABLE_EXISTS FROM DB.INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'VRM_SAVED_QUERIES';",
    { useServiceCredentials: true }
  )

  const alreadyExists = Array.isArray(exists) && exists.length > 0

  if (alreadyExists) return

  await executeIsqlCommand(
    `CREATE TABLE ${TABLE_NAME} (
      ID VARCHAR(64) PRIMARY KEY,
      NAME VARCHAR(255) NOT NULL,
      QUERY_TEXT LONG VARCHAR NOT NULL,
      OWNER_ID VARCHAR(128) NOT NULL,
      OWNER_USERNAME VARCHAR(256) NOT NULL,
      CREATED_AT DATETIME NOT NULL,
      UPDATED_AT DATETIME NOT NULL
    );`,
    { useServiceCredentials: true }
  )

  await executeIsqlCommand(
    `CREATE INDEX ${OWNER_INDEX} ON ${TABLE_NAME}(owner_id)`,
    { useServiceCredentials: true }
  )

  await executeIsqlCommand(
    `CREATE INDEX ${UPDATED_INDEX} ON ${TABLE_NAME}(updated_at)`,
    { useServiceCredentials: true }
  )

  await executeIsqlCommand(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${TABLE_NAME} TO PUBLIC`,
    { useServiceCredentials: true }
  )
}

export async function listSavedQueries(
  currentUserId?: string | null
): Promise<SavedQuery[]> {
  await ensureTableExists()

  const rows = await executeIsqlCommand<SavedQueryRow[]>(
    `SELECT ID, NAME, QUERY_TEXT, OWNER_ID, OWNER_USERNAME, CREATED_AT, UPDATED_AT
     FROM ${TABLE_NAME}
     ORDER BY UPDATED_AT DESC;`,
    { useServiceCredentials: true }
  )

  if (!rows || !Array.isArray(rows)) return []

  return rows.map((row) => mapRowToSavedQuery(row, currentUserId))
}

export async function getSavedQueryById(
  id: string,
  currentUserId?: string | null
): Promise<SavedQuery | null> {
  await ensureTableExists()

  const escapedId = escapeSqlLiteral(id)
  const rows = await executeIsqlCommand<SavedQueryRow[]>(
    `SELECT TOP 1 ID, NAME, QUERY_TEXT, OWNER_ID, OWNER_USERNAME, CREATED_AT, UPDATED_AT
     FROM ${TABLE_NAME}
     WHERE ID = '${escapedId}';`,
    { useServiceCredentials: true }
  )

  const row = rows?.[0]
  if (!row) return null

  return mapRowToSavedQuery(row, currentUserId)
}

interface SavePayload {
  name: string
  query: string
}

export async function createSavedQuery(
  payload: SavePayload,
  user: { id: string; username: string } | null
): Promise<SavedQuery> {
  if (!user) {
    throw new AuthError('Authentication required to save queries')
  }

  await ensureTableExists()

  const name = payload.name?.trim()
  const query = payload.query?.trim()

  if (!name) {
    throw new QueryError('A name is required to save a query')
  }
  if (!query) {
    throw new QueryError('Cannot save an empty query')
  }

  const id = crypto.randomUUID()
  const escapedId = escapeSqlLiteral(id)
  const escapedName = escapeSqlLiteral(name.slice(0, 255))
  const escapedQuery = escapeSqlLiteral(query)
  const escapedOwnerId = escapeSqlLiteral(user.id)
  const escapedOwnerUsername = escapeSqlLiteral(user.username)

  await executeIsqlWithAuth(
    `INSERT INTO ${TABLE_NAME} (ID, NAME, QUERY_TEXT, OWNER_ID, OWNER_USERNAME, CREATED_AT, UPDATED_AT)
     VALUES ('${escapedId}', '${escapedName}', '${escapedQuery}', '${escapedOwnerId}', '${escapedOwnerUsername}', NOW(), NOW());`
  )

  const created = await getSavedQueryById(id, user.id)
  if (!created) {
    throw new QueryError('Failed to persist saved query')
  }

  return created
}

export async function updateSavedQuery(
  id: string,
  payload: SavePayload,
  user: { id: string; username: string } | null
): Promise<SavedQuery> {
  if (!user) {
    throw new AuthError('Authentication required to update queries')
  }

  await ensureTableExists()

  const existing = await getSavedQueryById(id, user.id)
  if (!existing) {
    throw new QueryError('Saved query not found')
  }

  if (existing.ownerId !== user.id) {
    throw new AuthError('You do not own this saved query')
  }

  const name = payload.name?.trim()
  const query = payload.query?.trim()

  if (!name) {
    throw new QueryError('A name is required to update a query')
  }
  if (!query) {
    throw new QueryError('Cannot save an empty query')
  }

  const escapedId = escapeSqlLiteral(id)
  const escapedName = escapeSqlLiteral(name.slice(0, 255))
  const escapedQuery = escapeSqlLiteral(query)

  await executeIsqlWithAuth(
    `UPDATE ${TABLE_NAME}
     SET NAME = '${escapedName}',
         QUERY_TEXT = '${escapedQuery}',
         UPDATED_AT = NOW()
     WHERE ID = '${escapedId}';`
  )

  const updated = await getSavedQueryById(id, user.id)
  if (!updated) {
    throw new QueryError('Failed to update saved query')
  }

  return updated
}

export async function deleteSavedQuery(
  id: string,
  user: { id: string; username: string } | null
): Promise<void> {
  if (!user) {
    throw new AuthError('Authentication required to delete queries')
  }

  await ensureTableExists()

  const existing = await getSavedQueryById(id, user.id)
  if (!existing) {
    throw new QueryError('Saved query not found')
  }

  if (existing.ownerId !== user.id) {
    throw new AuthError('You do not own this saved query')
  }

  const escapedId = escapeSqlLiteral(id)

  await executeIsqlWithAuth(
    `DELETE FROM ${TABLE_NAME} WHERE ID = '${escapedId}';`
  )
}
