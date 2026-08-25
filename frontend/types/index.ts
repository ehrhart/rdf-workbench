export interface User {
  id: string
  username: string
  role?: 'admin' | 'user'
}

export interface NamedGraph {
  uri: string
  tripleCount: number
}

export interface QueryHistoryItem {
  id: string
  query: string
  timestamp: string
  duration: number
}

export interface SavedQuery {
  id: string
  name: string
  query: string
  ownerId: string
  ownerUsername: string
  createdAt: string
  updatedAt: string
  position: number
  isOwner: boolean
}

export interface EndpointStats {
  totalTriples: number
  namedGraphs: number
}

export interface ResourceSuggestion {
  id: string
  resource: string
  excerpt: string
  score: number
  rank: number
  graph: string
}

export interface FTRule {
  ROFR_G: string | null
  ROFR_P: string | null
  ROFR_REASON: string
}

export interface FTIndexStatus {
  batchMode: 'manual' | 'auto' | 'off'
  interval?: number
}

export type SparqlBindingValue =
  | { type: 'uri'; value: string }
  | {
      type: 'literal'
      value: string
      datatype?: string
      'xml:lang'?: string
    }
  | { type: 'bnode'; value: string }

export type SparqlBinding = Record<string, SparqlBindingValue>

export type RawSparqlBindingValue =
  | SparqlBindingValue
  | { type: 'typed-literal'; value: string; datatype: string }

export type RawSparqlBinding = Record<string, RawSparqlBindingValue>

export interface RawSparqlJsonResult {
  head: {
    vars?: string[]
  }
  results?: {
    bindings: RawSparqlBinding[]
  }
  boolean?: boolean
  meta?: Record<string, unknown>
}

export interface SparqlBindingsResult {
  kind: 'bindings'
  variables: string[]
  bindings: SparqlBinding[]
  meta?: Record<string, unknown>
}

export interface SparqlBooleanResult {
  kind: 'boolean'
  value: boolean
}

export type SparqlQueryResult = SparqlBindingsResult | SparqlBooleanResult

/** @deprecated Prefer SparqlQueryResult and narrow on `kind`. */
export type SparqlResult = SparqlBindingsResult

export interface RDFNode {
  value: string
  type: 'uri' | 'literal' | 'bnode'
  datatype?: string
  language?: string
}

export interface Triple {
  subject: RDFNode
  predicate: RDFNode
  object: RDFNode
  context: RDFNode
}

export * from './import'
