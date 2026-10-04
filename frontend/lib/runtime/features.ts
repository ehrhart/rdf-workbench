import type { FeatureId, TriplestoreProvider } from './contracts'

/**
 * Environment record read for feature derivation. Only
 * `QLEVER_ACCESS_TOKEN` affects the result, but the index signature
 * lets callers pass `process.env` directly (proxy.ts included).
 */
export type FeatureEnv = Record<string, string | undefined>

const baseFeatures: readonly FeatureId[] = [
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor',
  'user-admin'
]

const providerFeatures: Record<TriplestoreProvider, readonly FeatureId[]> = {
  virtuoso: [
    ...baseFeatures,
    'virtuoso-import',
    'virtuoso-export',
    'virtuoso-isql',
    'virtuoso-query-monitor',
    'virtuoso-namespaces',
    'virtuoso-fulltext',
    'virtuoso-graph-mutations'
  ],
  qlever: [...baseFeatures, 'qlever-namespaces'],
  oxigraph: [
    ...baseFeatures,
    'oxigraph-import',
    'oxigraph-graph-mutations',
    'oxigraph-namespaces'
  ]
}

/**
 * The authoritative definition of each provider's feature set.
 *
 * - `qlever-query-monitor` only when the qlever deployment has an access
 *   token for server-wide query monitoring.
 * - `ai-ask` only when AI_BASE_URL, AI_API_KEY and AI_MODEL are all set
 *   (same condition as `isAiAskEnabled` in lib/ai/config.ts, reimplemented
 *   on raw env because that module is server-only).
 */
export function computeFeatures(
  provider: TriplestoreProvider,
  env: FeatureEnv
): ReadonlySet<FeatureId> {
  const features = new Set<FeatureId>(providerFeatures[provider])

  if (provider === 'qlever' && env.QLEVER_ACCESS_TOKEN) {
    features.add('qlever-query-monitor')
  }

  if (isAiConfigured(env)) {
    features.add('ai-ask')
  }

  return features
}

/**
 * Whether the AI settings are configured. Shared with lib/ai/config.ts so
 * the feature set and the ask routes stay consistent.
 */
export function isAiConfigured(env: FeatureEnv): boolean {
  return (
    hasNonBlank(env.AI_BASE_URL) &&
    hasNonBlank(env.AI_API_KEY) &&
    hasNonBlank(env.AI_MODEL)
  )
}

function hasNonBlank(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== ''
}
