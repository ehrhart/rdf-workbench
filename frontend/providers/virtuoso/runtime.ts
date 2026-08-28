import 'server-only'

import { virtuosoNavigation } from '@/config/navigation'
import type {
  DownloadFormat,
  FeatureId,
  SparqlTransport,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import { virtuosoAuthAdapter } from './auth'
import {
  downloadQuery,
  executeQuery,
  getEndpointStats,
  getNamedGraphs,
  getPrefixes
} from './capabilities'
import { virtuosoQueryMonitor } from './query-monitor'
import { virtuosoSavedQueryRepository } from './saved-queries'

const TABULAR_FORMATS: readonly DownloadFormat[] = [
  { label: 'JSON', mime: 'application/sparql-results+json', extension: 'json' },
  { label: 'XML', mime: 'application/sparql-results+xml', extension: 'xml' },
  { label: 'CSV', mime: 'text/csv', extension: 'csv' },
  { label: 'TSV', mime: 'text/tab-separated-values', extension: 'tsv' }
]

const GRAPH_FORMATS: readonly DownloadFormat[] = [
  { label: 'Turtle', mime: 'text/turtle', extension: 'ttl' },
  { label: 'N-Triples', mime: 'application/n-triples', extension: 'nt' },
  { label: 'N-Quads', mime: 'application/n-quads', extension: 'nq' },
  { label: 'JSON-LD', mime: 'application/ld+json', extension: 'jsonld' },
  { label: 'RDF/XML', mime: 'application/rdf+xml', extension: 'rdf' }
]

const sparql: SparqlTransport = {
  execute: executeQuery,
  download: downloadQuery,
  getDownloadFormats(kind) {
    return kind === 'construct' || kind === 'describe'
      ? GRAPH_FORMATS
      : TABULAR_FORMATS
  }
}

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
