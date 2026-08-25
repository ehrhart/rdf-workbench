import 'server-only'

import { virtuosoNavigation } from '@/config/navigation'
import type {
  FeatureId,
  SparqlTransport,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import { virtuosoAuthAdapter } from './auth'
import { getEndpointStats, getNamedGraphs, getPrefixes } from './capabilities'
import { virtuosoQueryMonitor } from './query-monitor'
import { virtuosoSavedQueryRepository } from './saved-queries'
import { virtuosoSparqlTransport } from './sparql'

const sparql: SparqlTransport = virtuosoSparqlTransport

const features: ReadonlySet<FeatureId> = new Set([
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'saved-queries',
  'endpoint-monitor',
  'virtuoso-import',
  'virtuoso-isql',
  'virtuoso-query-monitor',
  'virtuoso-namespaces',
  'virtuoso-fulltext',
  'virtuoso-graph-mutations'
])

export const virtuosoRuntime: WorkbenchRuntime = {
  provider: 'virtuoso',
  label: 'Virtuoso',
  sparql,
  graphs: { listNamedGraphs: getNamedGraphs },
  prefixes: { list: getPrefixes },
  savedQueries: virtuosoSavedQueryRepository,
  auth: virtuosoAuthAdapter,
  features,
  navigation: virtuosoNavigation,
  queryMonitor: virtuosoQueryMonitor,
  async getEndpointOverview() {
    const stats = await getEndpointStats()
    return {
      healthy: stats.totalTriples > 0 || stats.namedGraphs > 0,
      name: 'Virtuoso',
      provider: 'virtuoso',
      stats: {
        'total-triples': stats.totalTriples,
        'named-graphs': stats.namedGraphs,
        'recent-queries': stats.recentQueries
      }
    }
  }
}
