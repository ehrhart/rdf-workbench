import type { FeatureId, TriplestoreProvider } from './contracts'

export type FeatureEnv = Record<string, string | undefined>

const baseFeatures: readonly FeatureId[] = [
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor',
  'user-admin',
  'query-monitor'
]

const providerFeatures: Record<TriplestoreProvider, readonly FeatureId[]> = {
  virtuoso: [
    ...baseFeatures,
    'virtuoso-import',
    'virtuoso-export',
    'virtuoso-isql',
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
  ],
  generic: [
    ...baseFeatures,
    'generic-namespaces',
    'generic-import',
    'generic-graph-mutations'
  ]
}

export function computeFeatures(
  provider: TriplestoreProvider,
  env: FeatureEnv
): ReadonlySet<FeatureId> {
  const features = new Set<FeatureId>(providerFeatures[provider])

  if (isAiConfigured(env)) {
    features.add('ai-ask')
  }

  return features
}

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
