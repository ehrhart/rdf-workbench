import type { NavigationConfig } from '@/config/navigation'
import type {
  NamedGraph,
  ResourceSuggestion,
  SavedQuery,
  SparqlQueryResult
} from '@/types'

export type TriplestoreProvider = 'virtuoso' | 'qlever' | 'oxigraph'

export type FeatureId =
  | 'dashboard'
  | 'sparql'
  | 'graphs'
  | 'resource-explorer'
  | 'dereference'
  | 'saved-queries'
  | 'endpoint-monitor'
  | 'virtuoso-import'
  | 'virtuoso-isql'
  | 'virtuoso-query-monitor'
  | 'virtuoso-namespaces'
  | 'virtuoso-fulltext'
  | 'virtuoso-graph-mutations'
  | 'qlever-namespaces'
  | 'qlever-user-admin'
  | 'qlever-query-monitor'
  | 'oxigraph-import'
  | 'oxigraph-graph-mutations'
  | 'oxigraph-namespaces'
  | 'oxigraph-user-admin'

export type SparqlQueryKind =
  | 'select'
  | 'ask'
  | 'construct'
  | 'describe'
  | 'update'
  | 'unknown'

export interface SparqlRequestOptions {
  timeoutMs?: number
  signal?: AbortSignal
  /** Assigns the QLever query id used for per-query tracking and cancellation. */
  queryId?: string
  /** Query kind, used to negotiate the upstream response format. */
  kind?: SparqlQueryKind
}

export interface DownloadFormat {
  label: string
  mime: string
  extension: string
}

export interface SparqlTransport {
  execute(
    query: string,
    options?: SparqlRequestOptions
  ): Promise<SparqlQueryResult>
  download(
    query: string,
    format: string,
    options?: SparqlRequestOptions
  ): Promise<Response>
  getDownloadFormats(kind: SparqlQueryKind): readonly DownloadFormat[]
}

export interface GraphReader {
  listNamedGraphs(): Promise<NamedGraph[]>
}

export interface PrefixSource {
  list(): Promise<Record<string, string>>
}

export interface PrefixStore extends PrefixSource {
  create(prefix: string, namespace: string): Promise<void>
  update(oldPrefix: string, prefix: string, namespace: string): Promise<void>
  delete(prefix: string): Promise<void>
}

export interface GraphMutations {
  getGraphTripleCount(uri: string): Promise<number>
  deleteGraph(uri: string): Promise<void>
  clearRepository(): Promise<void>
}

export interface SavedQueryInput {
  name: string
  query: string
}

export interface Principal {
  id: string
  username: string
  role: 'admin' | 'user'
}

export interface SavedQueryRepository {
  list(viewerId?: string | null): Promise<SavedQuery[]>
  get(id: string, viewerId?: string | null): Promise<SavedQuery | null>
  create(input: SavedQueryInput, owner: Principal | null): Promise<SavedQuery>
  update(
    id: string,
    input: SavedQueryInput,
    owner: Principal | null
  ): Promise<SavedQuery>
  delete(id: string, owner: Principal | null): Promise<void>
  reorder(
    order: Array<{ id: string; position: number }>,
    owner: Principal | null
  ): Promise<void>
}

export interface DereferencePath {
  path: string
}

export interface DereferenceRepository {
  list(): Promise<DereferencePath[]>
  create(path: string): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  remove(path: string): Promise<void>
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthAdapter {
  login(credentials: LoginCredentials): Promise<Principal>
  getPrincipal(): Promise<Principal | null>
  logout(): Promise<void>
  requireRole(role: Principal['role']): Promise<Principal>
}

export interface EndpointOverview {
  healthy: boolean
  name: string
  provider: TriplestoreProvider
  stats: Record<string, string | number | boolean | null>
  settings?: Record<string, string | number | boolean | null>
}

export interface RunningQueryInfo {
  id: string
  query: string
  lifetime: number
  state: 'RUNNING'
  /** Whether this query can be cancelled through the workbench. */
  cancellable: boolean
}

export interface QueryMonitorAdapter {
  listRunning(caller: Principal | null): Promise<RunningQueryInfo[]>
  cancel(id: string, caller: Principal | null): Promise<void>
}

export interface TextSearchAdapter {
  getResourceSuggestions(searchTerm: string): Promise<ResourceSuggestion[]>
}

export interface WorkbenchRuntime {
  provider: TriplestoreProvider
  label: string
  sparql: SparqlTransport
  graphs: GraphReader
  prefixes: PrefixStore
  savedQueries: SavedQueryRepository
  dereference: DereferenceRepository
  auth: AuthAdapter
  features: ReadonlySet<FeatureId>
  navigation: NavigationConfig
  queryMonitor?: QueryMonitorAdapter
  textSearch: TextSearchAdapter
  graphMutations?: GraphMutations
  getEndpointOverview(): Promise<EndpointOverview>
}
