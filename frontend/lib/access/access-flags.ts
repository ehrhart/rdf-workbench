import 'server-only'

import {
  allowAnonymousAskEntry,
  allowAnonymousReadEntry,
  allowAnonymousSparqlEntry,
  type SettingEntry
} from '@/lib/settings/registry'
import type { EnvResolution, SettingSource } from '@/lib/settings/resolve'
import { getStoredResolution } from '@/lib/settings/store'

export interface AccessFlags {
  allowAnonymousRead: boolean
  allowAnonymousAsk: boolean
  allowAnonymousSparql: boolean
}

const accessEntries = [
  allowAnonymousReadEntry,
  allowAnonymousAskEntry,
  allowAnonymousSparqlEntry
]

/**
 * The access flags, resolved through the settings store. No caching:
 * a saved or reset override must take effect on the next request.
 */
export async function getAccessFlags(): Promise<AccessFlags> {
  const [read, ask, sparql] = await Promise.all([
    getStoredResolution(allowAnonymousReadEntry),
    getStoredResolution(allowAnonymousAskEntry),
    getStoredResolution(allowAnonymousSparqlEntry)
  ])
  return {
    allowAnonymousRead: read.resolution.value,
    allowAnonymousAsk: ask.resolution.value,
    allowAnonymousSparql: sparql.resolution.value
  }
}

export interface AccessFlagDetail {
  key: string
  label: string
  description: string | null
  envVar: string | null
  currentValue: boolean
  source: SettingSource
  /** Stored UI override, or null when absent or invalid. */
  storedValue: boolean | null
  /** The environment variable's contribution, including when it is set but invalid. */
  env: EnvResolution<boolean>
}

export async function getAccessFlagDetails(): Promise<AccessFlagDetail[]> {
  return Promise.all(accessEntries.map(detailFor))
}

async function detailFor(
  entry: SettingEntry<boolean>
): Promise<AccessFlagDetail> {
  const { resolution, stored, env } = await getStoredResolution(entry)
  return {
    key: entry.key,
    label: entry.label,
    description: entry.description ?? null,
    envVar: entry.envVar,
    currentValue: resolution.value,
    source: resolution.source,
    storedValue: stored,
    env
  }
}
