import { z } from 'zod'

export interface SettingEntry<T = unknown> {
  key: string
  group: string
  label: string
  /** One sentence on what the setting changes, shown in the admin UI. */
  description?: string
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
  description:
    'Anonymous conversations spend the LLM budget of the deployment.',
  schema: booleanSetting,
  envVar: 'ALLOW_ANONYMOUS_ASK',
  defaultValue: false
}

/**
 * Numbers are stored as JSON numbers. Environment values are coerced from
 * strings, so '10' and 10 behave identically in both positions.
 */
function numberSetting(min: number, max: number): z.ZodType<number> {
  return z.coerce.number().int().min(min).max(max)
}

export const aiMaxStepsEntry: SettingEntry<number> = {
  key: 'ai.maxSteps',
  group: 'ai',
  label: 'Tool steps per answer',
  description:
    'How many tool calls the assistant may make while answering one question. Background graph exploration adds its own margin.',
  schema: numberSetting(2, 20),
  envVar: 'AI_MAX_STEPS',
  defaultValue: 20
}

export const aiQueryTimeoutMsEntry: SettingEntry<number> = {
  key: 'ai.queryTimeoutMs',
  group: 'ai',
  label: 'Query timeout',
  description:
    'How long one SPARQL query from the assistant may run before it is stopped.',
  schema: numberSetting(1_000, 120_000),
  envVar: 'AI_QUERY_TIMEOUT_MS',
  defaultValue: 30_000
}

export const aiResultLimitEntry: SettingEntry<number> = {
  key: 'ai.resultLimit',
  group: 'ai',
  label: 'Query result limit',
  description: 'Maximum rows one assistant query may return.',
  schema: numberSetting(1, 10_000),
  envVar: 'AI_RESULT_LIMIT',
  defaultValue: 1_000
}

export const aiJobTimeoutMsEntry: SettingEntry<number> = {
  key: 'ai.jobTimeoutMs',
  group: 'ai',
  label: 'Background job timeout',
  description:
    'How long a background graph exploration or profile rebuild may run.',
  schema: numberSetting(30_000, 3_600_000),
  envVar: 'AI_JOB_TIMEOUT_MS',
  defaultValue: 900_000
}

export const aiProfileMaxClassesEntry: SettingEntry<number> = {
  key: 'ai.profileMaxClasses',
  group: 'ai',
  label: 'Profiled classes',
  description: 'How many classes the dataset profile samples.',
  schema: numberSetting(1, 500),
  envVar: 'AI_PROFILE_MAX_CLASSES',
  defaultValue: 60
}

export const aiProfileMaxPropertiesEntry: SettingEntry<number> = {
  key: 'ai.profileMaxProperties',
  group: 'ai',
  label: 'Profiled properties per class',
  description: 'How many properties per class the dataset profile samples.',
  schema: numberSetting(1, 200),
  envVar: 'AI_PROFILE_MAX_PROPERTIES',
  defaultValue: 30
}

export const aiProfileMaxSamplesEntry: SettingEntry<number> = {
  key: 'ai.profileMaxSamples',
  group: 'ai',
  label: 'Sample values per property',
  description: 'How many sample values the profile collects per property.',
  schema: numberSetting(1, 10),
  envVar: 'AI_PROFILE_MAX_SAMPLES',
  defaultValue: 3
}

export const AI_TUNING_ENTRIES: readonly SettingEntry<number>[] = [
  aiMaxStepsEntry,
  aiQueryTimeoutMsEntry,
  aiResultLimitEntry,
  aiJobTimeoutMsEntry,
  aiProfileMaxClassesEntry,
  aiProfileMaxPropertiesEntry,
  aiProfileMaxSamplesEntry
]

export const SETTING_ENTRIES: readonly SettingEntry[] = [
  allowAnonymousReadEntry,
  allowAnonymousAskEntry,
  ...AI_TUNING_ENTRIES
]

export function getSettingEntry(key: string): SettingEntry | undefined {
  return SETTING_ENTRIES.find((entry) => entry.key === key)
}

export function getSettingEntries(group?: string): SettingEntry[] {
  return group
    ? SETTING_ENTRIES.filter((entry) => entry.group === group)
    : [...SETTING_ENTRIES]
}
