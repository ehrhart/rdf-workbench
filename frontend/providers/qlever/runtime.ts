import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { localPrefixSource } from '@/lib/local-prefixes'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import { savedQueryRepository } from '@/lib/saved-queries'
import { qleverGraphReader } from './graphs'
import { getQleverEndpointOverview } from './overview'
import { qleverQueryMonitor } from './query-monitor'
import { qleverSparqlTransport } from './sparql'
import { getResourceSuggestions } from './text-search'

const features: ReadonlySet<FeatureId> = computeFeatures('qlever', process.env)

const navigation = buildNavigation('qlever', features)

export const qleverRuntime: WorkbenchRuntime = {
  provider: 'qlever',
  label: 'QLever',
  sparql: qleverSparqlTransport,
  graphs: qleverGraphReader,
  prefixes: localPrefixSource,
  savedQueries: savedQueryRepository,
  dereference: dereferenceRepository,
  auth: localAuthAdapter,
  features,
  navigation,
  queryMonitor: qleverQueryMonitor,
  textSearch: { getResourceSuggestions },
  getEndpointOverview: getQleverEndpointOverview
}
