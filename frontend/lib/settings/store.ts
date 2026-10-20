import 'server-only'

import type Database from 'better-sqlite3'
import { z } from 'zod'
import { getWorkbenchDatabase } from '@/lib/workbench-database'
import { getSettingEntry, type SettingEntry } from './registry'
import {
  type EnvResolution,
  resolveEnvironmentValue,
  resolveSetting,
  type SettingResolution,
  type SettingSource
} from './resolve'

let driftChecked = false
let overrideLogged = false
let storeUnavailableWarned = false
const invalidStoredWarned = new Set<string>()

export interface StoredResolution<T = unknown> {
  /** Full precedence outcome: stored override, else environment, else default. */
  resolution: SettingResolution<T>
  /** The stored override alone, null when absent or invalid. */
  stored: T | null
  /** The environment variable's contribution, including when it is set but invalid. */
  env: EnvResolution<T>
}

/**
 * Resolves one setting through the precedence rule with a single store
 * read. Never throws for runtime problems: an unavailable store falls
 * back to env/default so request paths keep serving. A corrupt stored
 * value is logged once per key and treated as absent.
 */
export async function getStoredResolution<T>(
  entry: SettingEntry<T>
): Promise<StoredResolution<T>> {
  const resolutions = await getStoredResolutions([entry])
  return resolutions[entry.key]
}

/**
 * Resolves several settings with one store read. Never throws for
 * runtime problems, same contract as the single-key variant.
 */
export async function getStoredResolutions<T>(
  entries: readonly SettingEntry<T>[]
): Promise<Record<string, StoredResolution<T>>> {
  let storedValues: Map<string, T | null>
  try {
    const db = await getWorkbenchDatabase()
    checkDrift(db)
    const rows = selectRawStored(
      db,
      entries.map((entry) => entry.key)
    )
    const byKey = new Map(rows.map((row) => [row.key, row.value]))
    storedValues = new Map()
    for (const entry of entries) {
      storedValues.set(
        entry.key,
        parseStoredValue(entry, byKey.get(entry.key) ?? null)
      )
    }
  } catch (error) {
    warnStoreUnavailable(error)
    storedValues = new Map()
  }

  const resolutions: Record<string, StoredResolution<T>> = {}
  for (const entry of entries) {
    const stored = storedValues.get(entry.key) ?? null
    const resolution = resolveSetting(entry, stored ?? undefined, process.env)
    logOverride(entry, resolution)
    resolutions[entry.key] = {
      resolution,
      stored,
      env: resolveEnvironmentValue(entry, process.env)
    }
  }
  return resolutions
}

/**
 * Saves validated overrides and one history row per key in a single
 * transaction. Unknown keys and schema violations throw.
 */
export async function saveSettingValues(
  entries: Array<{ key: string; value: unknown }>,
  principal: string
): Promise<void> {
  const db = await getWorkbenchDatabase()
  const validated = entries.map(({ key, value }) => {
    const entry = getSettingEntry(key)
    if (!entry) {
      throw new Error(`Unknown setting key "${key}"`)
    }
    const result = entry.schema.safeParse(value)
    if (!result.success) {
      throw new Error(
        `Invalid value for setting "${key}": ${z.prettifyError(result.error)}`
      )
    }
    return { key: entry.key, value: result.data }
  })

  const now = new Date().toISOString()
  db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE
        SET value = excluded.value, updated_at = excluded.updated_at
    `)
    const selectValue = db.prepare('SELECT value FROM settings WHERE key = ?')
    const insertHistory = db.prepare(`
      INSERT INTO settings_history (key, old_value, new_value, principal, at)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const { key, value } of validated) {
      const serialized = JSON.stringify(value)
      const existing = selectValue.get(key) as { value: string } | undefined
      upsert.run(key, serialized, now)
      insertHistory.run(
        key,
        existing?.value ?? null,
        serialized,
        principal,
        now
      )
    }
  })()
}

/**
 * Removes the stored override for a key and records the reset in
 * history. Unknown keys throw.
 */
export async function resetSettingValue(
  key: string,
  principal: string
): Promise<void> {
  const db = await getWorkbenchDatabase()
  const entry = getSettingEntry(key)
  if (!entry) {
    throw new Error(`Unknown setting key "${key}"`)
  }

  const now = new Date().toISOString()
  db.transaction(() => {
    const existing = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(entry.key) as { value: string } | undefined
    db.prepare('DELETE FROM settings WHERE key = ?').run(entry.key)
    db.prepare(`
      INSERT INTO settings_history (key, old_value, new_value, principal, at)
      VALUES (?, ?, ?, ?, ?)
    `).run(entry.key, existing?.value ?? null, null, principal, now)
  })()
}

function selectRawStored(
  db: Database.Database,
  keys: string[]
): Array<{ key: string; value: string }> {
  if (keys.length === 0) return []
  const placeholders = keys.map(() => '?').join(', ')
  return db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .all(...keys) as Array<{ key: string; value: string }>
}

function parseStoredValue<T>(
  entry: SettingEntry<T>,
  raw: string | null
): T | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    warnInvalidStored(entry.key)
    return null
  }
  const result = entry.schema.safeParse(parsed)
  if (!result.success) {
    warnInvalidStored(entry.key)
    return null
  }
  return result.data
}

function warnInvalidStored(key: string): void {
  if (invalidStoredWarned.has(key)) return
  invalidStoredWarned.add(key)
  console.warn(`settings: stored value for "${key}" is invalid, falling back`)
}

function warnStoreUnavailable(error: unknown): void {
  if (storeUnavailableWarned) return
  storeUnavailableWarned = true
  console.warn(
    'settings: store unavailable, falling back to environment',
    error
  )
}

function checkDrift(db: Database.Database): void {
  if (driftChecked) return
  driftChecked = true
  const rows = db.prepare('SELECT key FROM settings').all() as Array<{
    key: string
  }>
  for (const row of rows) {
    if (!getSettingEntry(row.key)) {
      console.warn(
        `settings: unknown key "${row.key}" in store, no registry entry`
      )
    }
  }
}

function logOverride<T>(
  entry: SettingEntry<T>,
  resolution: SettingResolution<T>
): void {
  if (overrideLogged || resolution.source !== 'overridden') return
  overrideLogged = true
  const raw = entry.envVar ? process.env[entry.envVar] : undefined
  console.log(`settings: ${entry.key} overridden in UI (env=${raw ?? 'unset'})`)
}

export type { SettingSource }
