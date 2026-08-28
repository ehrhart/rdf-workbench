import 'server-only'

import {
  type NavItem,
  type NavigationConfig,
  qleverNavigation
} from '@/config/navigation'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type { FeatureId, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { qleverAuthAdapter } from './auth'
import { qleverGraphReader } from './graphs'
import { getQleverEndpointOverview } from './overview'
import { qleverPrefixSource } from './prefixes'
import { qleverQueryMonitor } from './query-monitor'
import { qleverSavedQueryRepository } from './saved-queries'
import { qleverSparqlTransport } from './sparql'

const qleverConfig = getRuntimeConfig()
const hasServerWideMonitor =
  qleverConfig.TRIPLESTORE_PROVIDER === 'qlever' &&
  Boolean(qleverConfig.QLEVER_ACCESS_TOKEN)

const features: ReadonlySet<FeatureId> = new Set([
  'dashboard',
  'sparql',
  'graphs',
  'resource-explorer',
  'saved-queries',
  'endpoint-monitor',
  'qlever-namespaces',
  'qlever-user-admin',
  ...(hasServerWideMonitor ? ['qlever-query-monitor' as FeatureId] : [])
])

const navigation: NavigationConfig = {
  ...qleverNavigation,
  navMain: qleverNavigation.navMain.map(
    (item): NavItem =>
      item.url === '/monitor/system'
        ? {
            title: 'Monitor',
            url: '/monitor/queries',
            icon: 'activity',
            requiredRole: 'admin',
            items: [
              ...(hasServerWideMonitor
                ? [{ title: 'Queries and update', url: '/monitor/queries' }]
                : []),
              { title: 'System', url: '/monitor/system' }
            ]
          }
        : item
  )
}

export const qleverRuntime: WorkbenchRuntime = {
  provider: 'qlever',
  label: 'QLever',
  sparql: qleverSparqlTransport,
  graphs: qleverGraphReader,
  prefixes: qleverPrefixSource,
  savedQueries: qleverSavedQueryRepository,
  auth: qleverAuthAdapter,
  features,
  navigation,
  queryMonitor: qleverQueryMonitor,
  getEndpointOverview: getQleverEndpointOverview
}
