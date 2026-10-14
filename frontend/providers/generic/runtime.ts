import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { localPrefixSource } from '@/lib/local-prefixes'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import { savedQueryRepository } from '@/lib/saved-queries'
import { createSpecGraphMutations } from '@/providers/spec/graph-mutations'
import { createSpecGraphReader } from '@/providers/spec/graphs'
import { createSpecTextSearch } from '@/providers/spec/text-search'
import { GENERIC_LABEL } from './config'
import { getGenericEndpointOverview } from './overview'
import { genericSparqlTransport } from './sparql'

const features: ReadonlySet<FeatureId> = computeFeatures('generic', process.env)

const navigation = buildNavigation('generic', features)

const sparql = genericSparqlTransport
const graphs = createSpecGraphReader(sparql)

export const genericRuntime: WorkbenchRuntime = {
  provider: 'generic',
  label: GENERIC_LABEL,
  sparql,
  graphs,
  prefixes: localPrefixSource,
  savedQueries: savedQueryRepository,
  dereference: dereferenceRepository,
  auth: localAuthAdapter,
  features,
  navigation,
  textSearch: createSpecTextSearch(sparql),
  graphMutations: createSpecGraphMutations(sparql),
  getEndpointOverview: () => getGenericEndpointOverview(graphs, sparql)
}
