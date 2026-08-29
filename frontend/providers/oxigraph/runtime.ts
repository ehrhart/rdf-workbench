import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { localPrefixSource } from '@/lib/local-prefixes'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { savedQueryRepository } from '@/lib/saved-queries'
import {
  clearRepository,
  deleteGraph,
  getGraphTripleCount
} from './graph-mutations'
import { oxigraphGraphReader } from './graphs'
import { getOxigraphEndpointOverview } from './overview'
import { oxigraphSparqlTransport } from './sparql'
import { getResourceSuggestions } from './text-search'

const features: ReadonlySet<FeatureId> = new Set([
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor',
  'oxigraph-import',
  'oxigraph-graph-mutations',
  'oxigraph-namespaces',
  'oxigraph-user-admin'
])

const navigation = buildNavigation('oxigraph', features)

export const oxigraphRuntime: WorkbenchRuntime = {
  provider: 'oxigraph',
  label: 'Oxigraph',
  sparql: oxigraphSparqlTransport,
  graphs: oxigraphGraphReader,
  prefixes: localPrefixSource,
  savedQueries: savedQueryRepository,
  dereference: dereferenceRepository,
  auth: localAuthAdapter,
  features,
  navigation,
  textSearch: { getResourceSuggestions },
  graphMutations: { getGraphTripleCount, deleteGraph, clearRepository },
  getEndpointOverview: getOxigraphEndpointOverview
}
