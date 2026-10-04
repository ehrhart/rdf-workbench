import 'server-only'

import crypto from 'node:crypto'
import { QueryError } from '@/lib/errors'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

interface ConversationDbRow {
  id: string
  owner_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationRow {
  id: string
  title: string
  ownerId: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

const DEFAULT_TITLE = 'New chat'
const MAX_TITLE_LENGTH = 120
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_CONVERSATION_MESSAGES = 200
const MESSAGE_ROLES = new Set(['user', 'assistant', 'system'])

const CONVERSATION_SELECT = `
  SELECT c.*,
    (
      SELECT COUNT(*)
      FROM conversation_messages m
      WHERE m.conversation_id = c.id
    ) AS message_count
  FROM conversations c
`

function mapConversation(row: ConversationDbRow): ConversationRow {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: Number(row.message_count ?? 0)
  }
}

function normalizeTitle(title: string | undefined | null): string {
  const trimmed = (title ?? '').trim().slice(0, MAX_TITLE_LENGTH)
  return trimmed || DEFAULT_TITLE
}

function isStorableMessage(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const message = value as { id?: unknown; role?: unknown }
  return (
    typeof message.id === 'string' &&
    typeof message.role === 'string' &&
    MESSAGE_ROLES.has(message.role)
  )
}

export async function listConversations(
  ownerId: string
): Promise<ConversationRow[]> {
  const db = await getWorkbenchDatabase()
  const rows = db
    .prepare(
      `${CONVERSATION_SELECT}
       WHERE c.owner_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(ownerId) as ConversationDbRow[]
  return rows.map(mapConversation)
}

export async function createConversation(
  ownerId: string,
  title?: string,
  options?: { id?: string }
): Promise<ConversationRow> {
  const db = await getWorkbenchDatabase()
  const requested = options?.id
  const id =
    requested && UUID_PATTERN.test(requested) ? requested : crypto.randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT INTO conversations (id, owner_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(id, ownerId, normalizeTitle(title), now, now)
  const created = await getConversation(id, ownerId)
  if (!created) throw new QueryError('Failed to persist conversation')
  return created
}

export async function getConversation(
  id: string,
  ownerId: string
): Promise<ConversationRow | null> {
  const db = await getWorkbenchDatabase()
  const row = db
    .prepare(`${CONVERSATION_SELECT} WHERE c.id = ? AND c.owner_id = ?`)
    .get(id, ownerId) as ConversationDbRow | undefined
  return row ? mapConversation(row) : null
}

export async function renameConversation(
  id: string,
  ownerId: string,
  title: string
): Promise<ConversationRow | null> {
  const name = title.trim().slice(0, MAX_TITLE_LENGTH)
  if (!name) throw new QueryError('A conversation title is required')
  const db = await getWorkbenchDatabase()
  const result = db
    .prepare('UPDATE conversations SET title = ? WHERE id = ? AND owner_id = ?')
    .run(name, id, ownerId)
  if (result.changes === 0) return null
  return getConversation(id, ownerId)
}

export async function deleteConversation(
  id: string,
  ownerId: string
): Promise<boolean> {
  const db = await getWorkbenchDatabase()
  const result = db
    .prepare('DELETE FROM conversations WHERE id = ? AND owner_id = ?')
    .run(id, ownerId)
  return result.changes > 0
}

export async function replaceMessages(
  id: string,
  ownerId: string,
  messages: unknown[]
): Promise<number | null> {
  if (
    !Array.isArray(messages) ||
    messages.length > MAX_CONVERSATION_MESSAGES ||
    !messages.every(isStorableMessage)
  ) {
    throw new QueryError(
      `Messages must be an array of at most ${MAX_CONVERSATION_MESSAGES} objects with a string id and a user, assistant, or system role`
    )
  }

  const db = await getWorkbenchDatabase()
  return db.transaction(() => {
    const owned = db
      .prepare('SELECT id FROM conversations WHERE id = ? AND owner_id = ?')
      .get(id, ownerId)
    if (!owned) return null

    db.prepare(
      'DELETE FROM conversation_messages WHERE conversation_id = ?'
    ).run(id)
    const insert = db.prepare(
      'INSERT INTO conversation_messages (conversation_id, position, message) VALUES (?, ?, ?)'
    )
    messages.forEach((message, position) => {
      insert.run(id, position, JSON.stringify(message))
    })
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id
    )
    return messages.length
  })()
}

export async function getMessages(
  id: string,
  ownerId: string
): Promise<unknown[]> {
  const db = await getWorkbenchDatabase()
  const rows = db
    .prepare(
      `
      SELECT m.message
      FROM conversation_messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ? AND c.owner_id = ?
      ORDER BY m.position ASC
    `
    )
    .all(id, ownerId) as Array<{ message: string }>
  const messages: unknown[] = []
  for (const row of rows) {
    try {
      messages.push(JSON.parse(row.message) as unknown)
    } catch (error) {
      console.error(
        'Skipping corrupted conversation message row:',
        id,
        error instanceof Error ? error.message : error
      )
    }
  }
  return messages
}
