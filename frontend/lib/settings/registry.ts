import { z } from 'zod'

export interface SettingEntry<T = unknown> {
  key: string
  group: string
  label: string
  /** Validates both stored JSON values and raw environment values. */
  schema: z.ZodType<T>
  envVar: string | null
  defaultValue: T
}

/**
 * Booleans are stored as JSON booleans. Environment values accept '1' or
 * a case-insensitive 'true' as true and '0' or a case-insensitive 'false'
 * as false, matching the historical env semantics in both directions.
 */
const booleanSetting: z.ZodType<boolean> = z.preprocess((input) => {
  if (typeof input !== 'string') return input
  const normalized = input.toLowerCase()
  if (input === '1' || normalized === 'true') return true
  if (input === '0' || normalized === 'false') return false
  return input
}, z.boolean())

export const allowAnonymousReadEntry: SettingEntry<boolean> = {
  key: 'access.allowAnonymousRead',
  group: 'access',
  label: 'Browse without an account',
  schema: booleanSetting,
  envVar: 'ALLOW_ANONYMOUS_READ',
  defaultValue: false
}

export const allowAnonymousAskEntry: SettingEntry<boolean> = {
  key: 'access.allowAnonymousAsk',
  group: 'access',
  label: 'Chat without an account',
  schema: booleanSetting,
  envVar: 'ALLOW_ANONYMOUS_ASK',
  defaultValue: false
}

export const SETTING_ENTRIES: readonly SettingEntry[] = [
  allowAnonymousReadEntry,
  allowAnonymousAskEntry
]

export function getSettingEntry(key: string): SettingEntry | undefined {
  return SETTING_ENTRIES.find((entry) => entry.key === key)
}

export function getSettingEntries(group?: string): SettingEntry[] {
  return group
    ? SETTING_ENTRIES.filter((entry) => entry.group === group)
    : [...SETTING_ENTRIES]
}
