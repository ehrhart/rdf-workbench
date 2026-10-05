import 'server-only'

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { hash } from '@node-rs/argon2'
import Database from 'better-sqlite3'
import { getRuntimeConfig } from '@/lib/runtime/config'

const DEFAULT_PREFIXES: Record<string, string> = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dcterms: 'http://purl.org/dc/terms/',
  schema: 'https://schema.org/'
}

let database: Database.Database | undefined
let initialization: Promise<Database.Database> | undefined

function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const current = db
    .prepare(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
    )
    .get() as { version: number }

  if (current.version < 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
          disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX sessions_user_idx ON sessions(user_id);
        CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

        CREATE TABLE saved_queries (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          query_text TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          owner_username TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX saved_queries_owner_idx ON saved_queries(owner_id);
        CREATE INDEX saved_queries_updated_idx ON saved_queries(updated_at DESC);

        CREATE TABLE prefixes (
          prefix TEXT PRIMARY KEY COLLATE NOCASE,
          namespace TEXT NOT NULL,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)

      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 2) {
    db.transaction(() => {
      const columns = db
        .prepare('PRAGMA table_info(saved_queries)')
        .all() as Array<{ name: string }>
      const hasPosition = columns.some((column) => column.name === 'position')
      if (!hasPosition) {
        db.exec(
          'ALTER TABLE saved_queries ADD COLUMN position INTEGER NOT NULL DEFAULT 0;'
        )
      }
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 3) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE dereference_paths (
          path TEXT PRIMARY KEY,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 5) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE dataset_profiles (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          built_at TEXT NOT NULL,
          triple_count INTEGER,
          prefixes TEXT NOT NULL DEFAULT '{}',
          graphs TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE profile_classes (
          profile_id TEXT NOT NULL REFERENCES dataset_profiles(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          iri TEXT NOT NULL,
          label TEXT,
          instance_count INTEGER NOT NULL
        );
        CREATE INDEX profile_classes_profile_idx ON profile_classes(profile_id);

        CREATE TABLE profile_properties (
          profile_id TEXT NOT NULL REFERENCES dataset_profiles(id) ON DELETE CASCADE,
          class_iri TEXT NOT NULL,
          iri TEXT NOT NULL,
          usage_count INTEGER NOT NULL,
          object_types TEXT NOT NULL,
          samples TEXT NOT NULL
        );
        CREATE INDEX profile_properties_profile_idx ON profile_properties(profile_id);
      `)
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 6) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX conversations_owner_idx ON conversations(owner_id, updated_at DESC);

        CREATE TABLE conversation_messages (
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          message TEXT NOT NULL,
          PRIMARY KEY (conversation_id, position)
        );
      `)
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 7) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE ai_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          example_questions TEXT NOT NULL DEFAULT '[]',
          custom_instruction TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        );
      `)
      db.prepare(
        'INSERT INTO ai_settings (id, example_questions, custom_instruction, updated_at) VALUES (1, ?, ?, ?)'
      ).run('[]', '', new Date().toISOString())
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 8) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE ai_settings ADD COLUMN graph_knowledge TEXT NOT NULL DEFAULT '';
      `)
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?)'
      ).run(new Date().toISOString())
    })()
  }

  if (current.version < 9) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE conversation_shares (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          messages TEXT NOT NULL,
          message_count INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX conversation_shares_conversation_idx ON conversation_shares(conversation_id);
      `)
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?)'
      ).run(new Date().toISOString())
    })()
  }

  const prefixCount = db
    .prepare('SELECT COUNT(*) AS count FROM prefixes')
    .get() as {
    count: number
  }
  if (prefixCount.count === 0) {
    const insert = db.prepare(`
      INSERT INTO prefixes
        (prefix, namespace, created_by, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?)
    `)
    const now = new Date().toISOString()
    db.transaction(() => {
      for (const [prefix, namespace] of Object.entries(DEFAULT_PREFIXES)) {
        insert.run(prefix, namespace, now, now)
      }
    })()
  }
}

async function initialize(): Promise<Database.Database> {
  const config = getRuntimeConfig()
  const directory = path.dirname(config.WORKBENCH_DB_PATH)
  if (!directory) {
    throw new Error('WORKBENCH_DB_PATH must include a writable directory')
  }
  fs.mkdirSync(directory, { recursive: true })

  const db = new Database(config.WORKBENCH_DB_PATH)
  migrate(db)

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get() as {
    count: number
  }
  if (userCount.count === 0) {
    const now = new Date().toISOString()
    const passwordHash = await hash(config.BOOTSTRAP_ADMIN_PASSWORD)
    db.prepare(`
      INSERT INTO users
        (id, username, password_hash, role, disabled, created_at, updated_at)
      VALUES (?, ?, ?, 'admin', 0, ?, ?)
    `).run(
      crypto.randomUUID(),
      config.BOOTSTRAP_ADMIN_USERNAME.trim().toLowerCase(),
      passwordHash,
      now,
      now
    )
  }
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(
    new Date().toISOString()
  )

  database = db
  return db
}

export async function getWorkbenchDatabase(): Promise<Database.Database> {
  if (database) return database
  initialization ??= initialize()
  return initialization
}
