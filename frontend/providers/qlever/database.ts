import 'server-only'

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { hash } from '@node-rs/argon2'
import Database from 'better-sqlite3'
import {
  getRuntimeConfig,
  type QleverRuntimeConfig
} from '@/lib/runtime/config'

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

function getQleverConfig(): QleverRuntimeConfig {
  const config = getRuntimeConfig()
  if (config.TRIPLESTORE_PROVIDER !== 'qlever') {
    throw new Error('QLever database requested in a Virtuoso deployment')
  }
  return config
}

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
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  const config = getQleverConfig()
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

export async function getQleverDatabase(): Promise<Database.Database> {
  if (database) return database
  initialization ??= initialize()
  return initialization
}
