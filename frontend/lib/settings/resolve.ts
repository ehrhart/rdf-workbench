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

  const envValue = resolveEnvironmentValue(entry, env)
  if (envValue.state === 'valid') {
    return { value: envValue.value, source: 'environment' }
  }

  return { value: entry.defaultValue, source: 'default' }
}

/**
 * The environment contribution for one setting, including the invalid
 * case so admin UIs can say the variable is set but unusable. An invalid
 * value never resolves; callers fall to the default.
 */
export type EnvResolution<T = unknown> =
  | { state: 'unset' }
  | { state: 'valid'; value: T }
  | { state: 'invalid'; raw: string }

export function resolveEnvironmentValue<T>(
  entry: SettingEntry<T>,
  env: Record<string, string | undefined>
): EnvResolution<T> {
  if (!entry.envVar) return { state: 'unset' }
  const raw = env[entry.envVar]
  if (raw === undefined) return { state: 'unset' }
  const parsed = entry.schema.safeParse(raw)
  return parsed.success
    ? { state: 'valid', value: parsed.data }
    : { state: 'invalid', raw }
}
