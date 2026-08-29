import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  FeatureId,
  SparqlTransport,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import { savedQueryRepository } from '@/lib/saved-queries'
import { virtuosoAuthAdapter } from './auth'
import {
  addPrefix,
  deletePrefix,
  getEndpointStats,
  getNamedGraphs,
  getPrefixes,
  getResourceSuggestions,
  updatePrefix
} from './capabilities'
import { virtuosoQueryMonitor } from './query-monitor'
import { virtuosoSparqlTransport } from './sparql'

const sparql: SparqlTransport = virtuosoSparqlTransport

const features: ReadonlySet<FeatureId> = new Set([
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor',
  'virtuoso-import',
  'virtuoso-isql',
  'virtuoso-query-monitor',
  'virtuoso-namespaces',
  'virtuoso-fulltext',
  'virtuoso-graph-mutations'
])

const navigation = buildNavigation('virtuoso', features)

export const virtuosoRuntime: WorkbenchRuntime = {
  provider: 'virtuoso',
  label: 'Virtuoso',
  sparql,
  graphs: { listNamedGraphs: getNamedGraphs },
  prefixes: {
    list: getPrefixes,
    create: async (prefix, namespace) => {
      await addPrefix(prefix, namespace)
    },
    update: async (oldPrefix, prefix, namespace) => {
      await updatePrefix(oldPrefix, prefix, namespace)
    },
    delete: deletePrefix
  },
  savedQueries: savedQueryRepository,
  dereference: dereferenceRepository,
  auth: virtuosoAuthAdapter,
  features,
  navigation,
  queryMonitor: virtuosoQueryMonitor,
  textSearch: { getResourceSuggestions },
  async getEndpointOverview() {
    const config = getRuntimeConfig()
    if (config.TRIPLESTORE_PROVIDER !== 'virtuoso') {
      throw new Error('Virtuoso runtime used with a different provider')
    }
    const [stats, adapter] = await Promise.all([
      getEndpointStats(),
      fetch(new URL('/health', config.VIRTUOSO_ADAPTER_URL), {
        cache: 'no-store'
      })
        .then((response) => response.ok)
        .catch(() => false)
    ])
    return {
      healthy: adapter,
      name: 'Virtuoso',
      provider: 'virtuoso',
      stats: {
        'total-triples': stats.totalTriples,
        'named-graphs': stats.namedGraphs
      }
    }
  }
}
