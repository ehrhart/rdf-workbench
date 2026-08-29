import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  DownloadFormat,
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { TABULAR_FORMATS } from '@/lib/sparql/negotiation'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

const GRAPH_FORMATS: readonly DownloadFormat[] = [
  { label: 'Turtle', mime: 'text/turtle', extension: 'ttl' },
  { label: 'N-Triples', mime: 'application/n-triples', extension: 'nt' },
  { label: 'RDF/XML', mime: 'application/rdf+xml', extension: 'rdf' }
]

function config() {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'oxigraph') {
    throw new Error('Oxigraph transport requested in a different deployment')
  }
  return value
}

async function fetchOxigraph(
  query: string,
  contentType: string,
  accept: string,
  options: SparqlRequestOptions = {}
): Promise<Response> {
  const runtime = config()

  const timeoutMs = options.timeoutMs ?? runtime.SPARQL_TIMEOUT_MS
  const signals: AbortSignal[] = []
  if (options.signal) signals.push(options.signal)
  let timeout: ReturnType<typeof setTimeout> | null = null
  let timeoutController: AbortController | null = null
  if (timeoutMs > 0) {
    timeoutController = new AbortController()
    timeout = setTimeout(() => timeoutController?.abort(), timeoutMs)
    signals.push(timeoutController.signal)
  }
  const signal =
    signals.length === 0
      ? undefined
      : signals.length === 1
        ? signals[0]
        : AbortSignal.any(signals)

  try {
    return await fetch(runtime.SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: accept,
        'Content-Type': contentType
      },
      body: query,
      signal,
      cache: 'no-store'
    })
  } catch (error) {
    if (timeoutController?.signal.aborted) {
      throw new SparqlTimeoutError(timeoutMs)
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export const oxigraphSparqlTransport: SparqlTransport = {
  async execute(query, options): Promise<SparqlQueryResult> {
    const kind = options?.kind
    const isGraph = kind === 'construct' || kind === 'describe'
    const isUpdate = kind === 'update'
    const contentType = isUpdate
      ? 'application/sparql-update'
      : 'application/sparql-query'
    const response = await fetchOxigraph(
      query,
      contentType,
      isGraph ? 'text/turtle' : 'application/sparql-results+json',
      options
    )
    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        body || `Oxigraph query failed with status ${response.status}`
      )
    }

    if (isUpdate) {
      return { kind: 'boolean', value: true }
    }

    if (isGraph) {
      return {
        kind: 'graph',
        value: await response.text(),
        format: 'text/turtle'
      }
    }

    const responseContentType = response.headers.get('content-type') ?? ''
    if (!responseContentType.includes('json')) {
      throw new Error(
        `Expected SPARQL JSON results but received ${responseContentType || 'no content type'}`
      )
    }

    return normalizeSparqlJsonResult(await response.json())
  },

  download(query, format, options) {
    return fetchOxigraph(query, 'application/sparql-query', format, options)
  },

  getDownloadFormats(kind) {
    if (kind === 'construct' || kind === 'describe') return GRAPH_FORMATS
    if (kind === 'select') return TABULAR_FORMATS
    return []
  }
}
