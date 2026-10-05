import 'server-only'

import crypto from 'node:crypto'
import {
  isStorableMessage,
  MAX_CONVERSATION_MESSAGES
} from '@/lib/ai/conversation-store'
import { QueryError } from '@/lib/errors'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

interface ConversationShareDbRow {
  id: string
  conversation_id: string
  owner_id: string
  title: string
  messages: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ConversationShareRow {
  id: string
  conversationId: string
  ownerId: string
  title: string
  messages: unknown[]
  messageCount: number
  createdAt: string
  updatedAt: string
}

const MAX_MESSAGES_JSON_LENGTH = 4_000_000

const SHARE_SELECT = `
  SELECT s.*, c.owner_id
  FROM conversation_shares s
  JOIN conversations c ON c.id = s.conversation_id
`

function mapShare(row: ConversationShareDbRow): ConversationShareRow | null {
  let messages: unknown[]
  try {
    messages = JSON.parse(row.messages) as unknown[]
  } catch (error) {
    console.error(
      'Skipping corrupted conversation share row:',
      row.id,
      error instanceof Error ? error.message : error
    )
    return null
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    ownerId: row.owner_id,
    title: row.title,
    messages,
    messageCount: Number(row.message_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function getShareById(
  id: string
): Promise<ConversationShareRow | null> {
  const db = await getWorkbenchDatabase()
  const row = db.prepare(`${SHARE_SELECT} WHERE s.id = ?`).get(id) as
    | ConversationShareDbRow
    | undefined
  return row ? mapShare(row) : null
}

export async function getShareForConversation(
  conversationId: string,
  ownerId: string
): Promise<ConversationShareRow | null> {
  const db = await getWorkbenchDatabase()
  const row = db
    .prepare(`${SHARE_SELECT} WHERE s.conversation_id = ? AND c.owner_id = ?`)
    .get(conversationId, ownerId) as ConversationShareDbRow | undefined
  return row ? mapShare(row) : null
}

export async function upsertShare(
  conversationId: string,
  ownerId: string,
  messages: unknown[]
): Promise<ConversationShareRow | null> {
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_CONVERSATION_MESSAGES ||
    !messages.every(isStorableMessage)
  ) {
    throw new QueryError(
      `Messages must be a non-empty array of at most ${MAX_CONVERSATION_MESSAGES} objects with a string id and a user, assistant, or system role`
    )
  }

  let serializedMessages: string[]
  try {
    serializedMessages = messages.map((message) => JSON.stringify(message))
  } catch {
    throw new QueryError('Messages must be JSON-serializable')
  }
  const totalLength = serializedMessages.reduce(
    (total, serialized) => total + serialized.length,
    0
  )
  if (totalLength > MAX_MESSAGES_JSON_LENGTH) {
    throw new QueryError(
      `Messages must total at most ${MAX_MESSAGES_JSON_LENGTH} characters`
    )
  }

  const db = await getWorkbenchDatabase()
  // Transaction callbacks must stay synchronous: better-sqlite3 throws on a
  // returned promise, so the owned-read lookup happens after the commit.
  const inserted = db.transaction(() => {
    const conversation = db
      .prepare(
        'SELECT id, title FROM conversations WHERE id = ? AND owner_id = ?'
      )
      .get(conversationId, ownerId) as { id: string; title: string } | undefined
    if (!conversation) return false

    const now = new Date().toISOString()
    db.prepare(
      `
      INSERT INTO conversation_shares (id, conversation_id, title, messages, message_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        title = excluded.title,
        messages = excluded.messages,
        message_count = excluded.message_count,
        updated_at = excluded.updated_at
    `
    ).run(
      crypto.randomUUID(),
      conversationId,
      conversation.title,
      JSON.stringify(messages),
      messages.length,
      now,
      now
    )
    return true
  })()
  if (!inserted) return null
  return getShareForConversation(conversationId, ownerId)
}

export async function deleteShare(
  conversationId: string,
  ownerId: string
): Promise<boolean> {
  const db = await getWorkbenchDatabase()
  const result = db
    .prepare(
      `
      DELETE FROM conversation_shares
      WHERE conversation_id = ?
        AND conversation_id IN (
          SELECT id FROM conversations WHERE id = ? AND owner_id = ?
        )
    `
    )
    .run(conversationId, conversationId, ownerId)
  return result.changes > 0
}
