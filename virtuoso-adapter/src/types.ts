export interface VirtuosoConnectionOptions {
  driver: string
  host: string
  port: number
  user?: string
  password?: string
  connectionTimeout: number
  loginTimeout: number
}

export interface SessionConfig {
  ttlMs: number
  cleanupIntervalMs: number
}

export interface AppConfig {
  port: number
  adapterToken: string
  virtuoso: VirtuosoConnectionOptions
  session: SessionConfig
  sparqlEndpoint: string
}

export interface VirtuosoUser {
  id: string
  username: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: VirtuosoUser
}

export interface QueryRequest {
  query: string
}

export type SparqlBindingValue =
  | { type: 'uri'; value: string }
  | { type: 'literal'; value: string; 'xml:lang'?: string }
  | { type: 'typed-literal'; value: string; datatype: string }
  | { type: 'bnode'; value: string }

export type SparqlResult =
  | {
      head: { vars: string[] }
      results: { bindings: Record<string, SparqlBindingValue>[] }
    }
  | { head?: Record<string, never>; boolean: boolean }

export interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  message?: string
}

export type StatementExecutionStatus = 'success' | 'error'

export interface StatementExecutionResult {
  statement: string
  rows: Record<string, unknown>[]
  rowCount: number
  status: StatementExecutionStatus
  errorMessage?: string
  errorCode?: string
}

export interface QueryResponse {
  results: Record<string, unknown>[]
  statements?: StatementExecutionResult[]
  hasErrors?: boolean
  errorMessage?: string
}

export interface ErrorResponse {
  error: string
  message: string
}

export interface BulkLoadRequest {
  filename: string
  graphIri: string
}

export interface BulkLoadResponse {
  jobId: string
  status: 'queued' | 'in-progress' | 'completed' | 'failed'
  message?: string
}

export interface UrlImportRequest {
  url: string
  filename?: string
  extension?: string
}

export interface TextImportRequest {
  content: string
  filename?: string
  extension?: string
}

export interface ExportGraphRequest {
  graphs: string[]
  format: string
  filename?: string
  fileLengthLimit?: number
}

export interface BulkLoadJobStatus {
  filename: string
  graphIri: string
  state: number
  status: 'queued' | 'in-progress' | 'completed' | 'failed'
  started: string
  done: string | null
  host: number
  workTime: number | null
  error: string | null
}

export interface LoadListRow {
  ll_file: string
  ll_graph: string
  ll_state: number
  ll_started: string
  ll_done: string | null
  ll_host: number
  ll_work_time: number | null
  ll_error: string | null
}

export interface CpuCountResult {
  st_cpu_count: number
}
