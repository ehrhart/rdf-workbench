import 'server-only'

import { buildNavigation } from '@/config/navigation'
import { dereferenceRepository } from '@/lib/dereference/repository'
import { localAuthAdapter } from '@/lib/local-auth'
import { localPrefixSource } from '@/lib/local-prefixes'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { savedQueryRepository } from '@/lib/saved-queries'
import { qleverGraphReader } from './graphs'
import { getQleverEndpointOverview } from './overview'
import { qleverQueryMonitor } from './query-monitor'
import { qleverSparqlTransport } from './sparql'
import { getResourceSuggestions } from './text-search'

const qleverConfig = getRuntimeConfig()
const hasServerWideMonitor =
  qleverConfig.TRIPLESTORE_PROVIDER === 'qlever' &&
  Boolean(qleverConfig.QLEVER_ACCESS_TOKEN)

const features: ReadonlySet<FeatureId> = new Set([
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'dereference',
  'saved-queries',
  'endpoint-monitor',
  'qlever-namespaces',
  'qlever-user-admin',
  ...(hasServerWideMonitor ? ['qlever-query-monitor' as FeatureId] : [])
])

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
