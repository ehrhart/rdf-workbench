import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  DownloadFormat,
  SparqlQueryKind,
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { detectSparqlQueryKind } from '@/lib/sparql/query-kind'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

const TABULAR_FORMATS: readonly DownloadFormat[] = [
  {
    label: 'JSON',
    mime: 'application/sparql-results+json',
    extension: 'json'
  },
  {
    label: 'XML',
    mime: 'application/sparql-results+xml',
    extension: 'xml'
  },
  { label: 'CSV', mime: 'text/csv', extension: 'csv' },
  {
    label: 'TSV',
    mime: 'text/tab-separated-values',
    extension: 'tsv'
  }
]

const GRAPH_FORMATS: readonly DownloadFormat[] = [
  { label: 'Turtle', mime: 'text/turtle', extension: 'ttl' }
]

function config() {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'qlever') {
    throw new Error('QLever transport requested in a Virtuoso deployment')
  }
  return value
}

function isReadQuery(kind: SparqlQueryKind): boolean {
  return (
    kind === 'select' ||
    kind === 'ask' ||
    kind === 'construct' ||
    kind === 'describe'
  )
}

async function fetchQlever(
  query: string,
  accept: string,
  options: SparqlRequestOptions = {}
): Promise<Response> {
  const runtime = config()
  const kind = detectSparqlQueryKind(query)
  if (kind === 'update') {
    throw new QleverReadOnlyError()
  }
  if (kind !== 'unknown' && !isReadQuery(kind)) {
    throw new Error('Unsupported SPARQL operation')
  }

  const timeoutMs = options.timeoutMs ?? runtime.SPARQL_TIMEOUT_MS
  const controller = options.signal ? null : new AbortController()
  const timeout =
    !options.signal && timeoutMs > 0
      ? setTimeout(() => controller?.abort(), timeoutMs)
      : null

  try {
    const body = new URLSearchParams({ query })
    return await fetch(runtime.SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: accept,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(options.queryId ? { 'Query-Id': options.queryId } : {})
      },
      body,
      signal: options.signal ?? controller?.signal,
      cache: 'no-store'
    })
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export class QleverReadOnlyError extends Error {
  constructor() {
    super('This QLever deployment is read-only; SPARQL Update is disabled')
    this.name = 'QleverReadOnlyError'
  }
}

export const qleverSparqlTransport: SparqlTransport = {
  async execute(query, options): Promise<SparqlQueryResult> {
    const kind = detectSparqlQueryKind(query)
    if (kind === 'construct' || kind === 'describe') {
      throw new Error(
        'CONSTRUCT and DESCRIBE results are available through Download as Turtle'
      )
    }
    const response = await fetchQlever(
      query,
      'application/sparql-results+json',
      options
    )
    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        body || `QLever query failed with status ${response.status}`
      )
    }
    return normalizeSparqlJsonResult(await response.json())
  },

  download(query, format, options) {
    const kind = detectSparqlQueryKind(query)
    const allowed = qleverSparqlTransport
      .getDownloadFormats(kind)
      .some((candidate) => candidate.mime === format)
    if (!allowed) {
      throw new Error(`QLever does not support ${format} for this query type`)
    }
    return fetchQlever(query, format, options)
  },

  getDownloadFormats(kind) {
    if (kind === 'construct' || kind === 'describe') return GRAPH_FORMATS
    if (kind === 'select') return TABULAR_FORMATS
    return []
  }
}
