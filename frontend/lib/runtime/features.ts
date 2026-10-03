import type { FeatureId, TriplestoreProvider } from './contracts'

/**
 * Environment record read for feature derivation. Only
 * `QLEVER_ACCESS_TOKEN` affects the result, but the index signature
 * lets callers pass `process.env` directly (proxy.ts included).
 */
export type FeatureEnv = Record<string, string | undefined>

/**
 * Features every provider exposes unconditionally.
 */
const baseFeatures: readonly FeatureId[] = [
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor'
]

/**
 * The provider-specific feature lists per provider.
 */
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
  qlever: [...baseFeatures, 'qlever-namespaces', 'qlever-user-admin'],
  oxigraph: [
    ...baseFeatures,
    'oxigraph-import',
    'oxigraph-graph-mutations',
    'oxigraph-namespaces',
    'oxigraph-user-admin'
  ]
}

/** The authoritative definition of each provider's feature set. */
export function computeFeatures(
  provider: TriplestoreProvider,
  env: FeatureEnv
): ReadonlySet<FeatureId> {
  const features = new Set<FeatureId>(providerFeatures[provider])

  if (provider === 'qlever' && env.QLEVER_ACCESS_TOKEN) {
    features.add('qlever-query-monitor')
  }

  return features
}
