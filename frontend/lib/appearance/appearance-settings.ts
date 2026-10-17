import 'server-only'

import { parseImageDataUrl } from '@/lib/appearance/branding'
import type {
  AppearanceSettings,
  DefaultMode,
  RadiusChoice
} from '@/lib/appearance/tokens'
import { getWorkbenchName } from '@/lib/runtime/config'
import { getWorkbenchDatabase } from '@/lib/workbench-database'

export type { AppearanceSettings, DefaultMode, RadiusChoice }

const HEX_PATTERN = /^#[0-9a-f]{6}$/i
const INSTANCE_NAME_MAX = 60

const RADIUS_IDS: readonly RadiusChoice[] = [
  'default',
  'sharp',
  'medium',
  'large'
]
const DEFAULT_MODE_IDS: readonly DefaultMode[] = ['light', 'dark', 'system']

const DEFAULTS: AppearanceSettings = {
  primaryColor: null,
  accentColor: null,
  sidebarColor: null,
  instanceName: null,
  radius: 'default',
  defaultMode: 'light'
}

interface AppearanceSettingsRow {
  primary_color: string | null
  accent_color: string | null
  sidebar_color: string | null
  instance_name: string | null
  radius: string
  default_mode: string
}

function normalizeColor(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim().toLowerCase()
  return HEX_PATTERN.test(trimmed) ? trimmed : null
}

function readChoice<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T
): T {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function normalizeInstanceName(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Reads the single settings row; a missing row, DB failure, or invalid value falls back to defaults. */
export async function getAppearanceSettings(): Promise<AppearanceSettings> {
  try {
    const db = await getWorkbenchDatabase()
    const row = db
      .prepare(
        'SELECT primary_color, accent_color, sidebar_color, instance_name, radius, default_mode FROM appearance_settings WHERE id = 1'
      )
      .get() as AppearanceSettingsRow | undefined
    if (!row) return { ...DEFAULTS }
    return {
      primaryColor: normalizeColor(row.primary_color),
      accentColor: normalizeColor(row.accent_color),
      sidebarColor: normalizeColor(row.sidebar_color),
      instanceName: normalizeInstanceName(row.instance_name),
      radius: readChoice(row.radius, RADIUS_IDS, 'default'),
      defaultMode: readChoice(row.default_mode, DEFAULT_MODE_IDS, 'light')
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function requireColor(value: string | null, label: string): string | null {
  if (value === null) return null
  const normalized = value.trim().toLowerCase()
  if (!HEX_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a #rrggbb hex color`)
  }
  return normalized
}

function requireChoice<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value as T
}

function requireInstanceName(value: string | null): string | null {
  const normalized = normalizeInstanceName(value)
  if (normalized !== null && normalized.length > INSTANCE_NAME_MAX) {
    throw new Error('Instance name must be 60 characters or fewer')
  }
  return normalized
}

export async function saveAppearanceSettings(
  input: AppearanceSettings
): Promise<AppearanceSettings> {
  const primaryColor = requireColor(input.primaryColor, 'Primary color')
  const accentColor = requireColor(input.accentColor, 'Accent color')
  const sidebarColor = requireColor(input.sidebarColor, 'Sidebar color')
  const instanceName = requireInstanceName(input.instanceName ?? null)
  const radius = requireChoice(input.radius, RADIUS_IDS, 'radius')
  const defaultMode = requireChoice(
    input.defaultMode,
    DEFAULT_MODE_IDS,
    'default mode'
  )

  const db = await getWorkbenchDatabase()
  db.prepare(
    `UPDATE appearance_settings
     SET primary_color = ?, accent_color = ?, sidebar_color = ?, instance_name = ?, radius = ?, default_mode = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    primaryColor,
    accentColor,
    sidebarColor,
    instanceName,
    radius,
    defaultMode,
    new Date().toISOString()
  )

  return {
    primaryColor,
    accentColor,
    sidebarColor,
    instanceName,
    radius,
    defaultMode
  }
}

export async function getInstanceName(): Promise<string> {
  const settings = await getAppearanceSettings()
  return settings.instanceName ?? getWorkbenchName()
}

export async function getAppearanceAssetMeta(
  kind: string
): Promise<{ mime: string; updatedAt: string } | null> {
  try {
    const db = await getWorkbenchDatabase()
    const row = db
      .prepare('SELECT mime, updated_at FROM appearance_assets WHERE kind = ?')
      .get(kind) as { mime: string; updated_at: string } | undefined
    return row ? { mime: row.mime, updatedAt: row.updated_at } : null
  } catch {
    return null
  }
}

export async function getAppearanceAsset(
  kind: string
): Promise<{ mime: string; data: string; updatedAt: string } | null> {
  const db = await getWorkbenchDatabase()
  const row = db
    .prepare(
      'SELECT mime, data, updated_at FROM appearance_assets WHERE kind = ?'
    )
    .get(kind) as { mime: string; data: string; updated_at: string } | undefined
  return row
    ? { mime: row.mime, data: row.data, updatedAt: row.updated_at }
    : null
}

export async function saveAppearanceAsset(
  kind: string,
  dataUrl: string
): Promise<{ updatedAt: string }> {
  const { mime, data } = parseImageDataUrl(dataUrl)
  const updatedAt = new Date().toISOString()
  const db = await getWorkbenchDatabase()
  db.prepare(
    `INSERT OR REPLACE INTO appearance_assets (kind, mime, data, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(kind, mime, data, updatedAt)
  return { updatedAt }
}

export async function removeAppearanceAsset(kind: string): Promise<void> {
  const db = await getWorkbenchDatabase()
  db.prepare('DELETE FROM appearance_assets WHERE kind = ?').run(kind)
}
