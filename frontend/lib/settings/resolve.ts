import type { SettingEntry } from './registry'

/**
 * Where a resolved setting's value came from: the environment variable, a
 * stored UI override, or the registry default.
 */
export type SettingSource = 'environment' | 'overridden' | 'default'

export interface SettingResolution<T = unknown> {
  value: T
  source: SettingSource
}

/**
 * The precedence rule for one setting, with no I/O. `stored` is the
 * schema-validated stored override, or undefined when no row exists or
 * the caller rejected the stored value as corrupt (parsing and logging
 * raw stored strings belong to the store).
 */
export function resolveSetting<T>(
  entry: SettingEntry<T>,
  stored: T | undefined,
  env: Record<string, string | undefined>
): SettingResolution<T> {
  if (stored !== undefined) {
    return { value: stored, source: 'overridden' }
  }

  if (entry.envVar) {
    const raw = env[entry.envVar]
    if (raw !== undefined) {
      const parsed = entry.schema.safeParse(raw)
      if (parsed.success) {
        return { value: parsed.data, source: 'environment' }
      }
    }
  }

  return { value: entry.defaultValue, source: 'default' }
}
