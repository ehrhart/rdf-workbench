import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { GRAPH_FORMATS, TABULAR_FORMATS } from '@/lib/sparql/negotiation'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

function config() {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new Error('Virtuoso transport requested in a QLever deployment')
  }
  return value
}

async function fetchVirtuoso(
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
    return await fetch(runtime.SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: accept,
        'Content-Type': 'application/sparql-query'
      },
      body: query,
      signal: options.signal ?? controller?.signal,
      cache: 'no-store'
    })
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export const virtuosoSparqlTransport: SparqlTransport = {
  async execute(query, options): Promise<SparqlQueryResult> {
    const response = await fetchVirtuoso(
      query,
      'application/sparql-results+json',
      options
    )
    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        body || `Virtuoso query failed with status ${response.status}`
      )
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
    return fetchVirtuoso(query, format, options)
  },

  getDownloadFormats(kind) {
    return kind === 'construct' || kind === 'describe'
      ? GRAPH_FORMATS
      : TABULAR_FORMATS
  }
}
