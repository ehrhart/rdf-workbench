import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  DownloadFormat,
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { TABULAR_FORMATS } from '@/lib/sparql/negotiation'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

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

async function fetchQlever(
  query: string,
  accept: string,
  options: SparqlRequestOptions = {}
): Promise<Response> {
  const runtime = config()

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

export const qleverSparqlTransport: SparqlTransport = {
  async execute(query, options): Promise<SparqlQueryResult> {
    const kind = options?.kind
    const isGraph = kind === 'construct' || kind === 'describe'
    const response = await fetchQlever(
      query,
      isGraph ? 'text/turtle' : 'application/sparql-results+json',
      options
    )
    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        body || `QLever query failed with status ${response.status}`
      )
    }

    if (isGraph) {
      return {
        kind: 'graph',
        value: await response.text(),
        format: 'text/turtle'
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) {
      throw new Error(
        `Expected SPARQL JSON results but received ${contentType || 'no content type'}`
      )
    }

    return normalizeSparqlJsonResult(await response.json())
  },

  download(query, format, options) {
    return fetchQlever(query, format, options)
  },

  getDownloadFormats(kind) {
    if (kind === 'construct' || kind === 'describe') return GRAPH_FORMATS
    if (kind === 'select') return TABULAR_FORMATS
    return []
  }
}
