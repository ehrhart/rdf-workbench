import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  FeatureId,
  SparqlTransport,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import { savedQueryRepository } from '@/lib/saved-queries'
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

const features: ReadonlySet<FeatureId> = computeFeatures(
  'virtuoso',
  process.env
)

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
  auth: localAuthAdapter,
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
      totalTriples: stats.totalTriples,
      stats: {
        'total-triples': stats.totalTriples,
        'named-graphs': stats.namedGraphs
      }
    }
  }
}
