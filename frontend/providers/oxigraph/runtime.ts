import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { localPrefixSource } from '@/lib/local-prefixes'
import { registryQueryMonitor } from '@/lib/query-monitor'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import { savedQueryRepository } from '@/lib/saved-queries'
import { createSpecGraphMutations } from '@/providers/spec/graph-mutations'
import { createSpecGraphReader } from '@/providers/spec/graphs'
import { createSpecTextSearch } from '@/providers/spec/text-search'
import { getOxigraphEndpointOverview } from './overview'
import { oxigraphSparqlTransport } from './sparql'

const features: ReadonlySet<FeatureId> = computeFeatures(
  'oxigraph',
  process.env
)

const navigation = buildNavigation('oxigraph', features)

const sparql = oxigraphSparqlTransport
const graphs = createSpecGraphReader(sparql)

export const oxigraphRuntime: WorkbenchRuntime = {
  provider: 'oxigraph',
  label: 'Oxigraph',
  sparql,
  graphs,
  prefixes: localPrefixSource,
  savedQueries: savedQueryRepository,
  dereference: dereferenceRepository,
  auth: localAuthAdapter,
  features,
  navigation,
  queryMonitor: registryQueryMonitor,
  textSearch: createSpecTextSearch(sparql),
  graphMutations: createSpecGraphMutations(sparql),
  getEndpointOverview: () => getOxigraphEndpointOverview(graphs, sparql)
}
