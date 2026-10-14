import 'server-only'

import type {
  DownloadFormat,
  SparqlRequestOptions,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { TABULAR_FORMATS } from '@/lib/sparql/negotiation'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

const SPEC_GRAPH_FORMATS: readonly DownloadFormat[] = [
  { label: 'Turtle', mime: 'text/turtle', extension: 'ttl' },
  { label: 'N-Triples', mime: 'application/n-triples', extension: 'nt' },
  { label: 'RDF/XML', mime: 'application/rdf+xml', extension: 'rdf' }
]

export interface SpecConnection {
  label: string
  endpoint: string
  timeoutMs: number
}

export interface SpecSparqlTransportOptions {
  resolveConnection(): SpecConnection
}

export function createSpecSparqlTransport(
  options: SpecSparqlTransportOptions
): SparqlTransport {
  async function post(
    connection: SpecConnection,
    query: string,
    contentType: string,
    accept: string,
    req: SparqlRequestOptions = {}
  ): Promise<Response> {
    const { endpoint, timeoutMs } = connection
    const signals: AbortSignal[] = []
    if (req.signal) signals.push(req.signal)
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
      return await fetch(endpoint, {
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

  return {
    async execute(query, req): Promise<SparqlQueryResult> {
      const kind = req?.kind
      const isGraph = kind === 'construct' || kind === 'describe'
      const isUpdate = kind === 'update'
      const contentType = isUpdate
        ? 'application/sparql-update'
        : 'application/sparql-query'
      const connection = options.resolveConnection()
      const response = await post(
        connection,
        query,
        contentType,
        isGraph ? 'text/turtle' : 'application/sparql-results+json',
        req
      )
      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          body ||
            `${connection.label} query failed with status ${response.status}`
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

    download(query, format, req) {
      return post(
        options.resolveConnection(),
        query,
        'application/sparql-query',
        format,
        req
      )
    },

    getDownloadFormats(kind) {
      if (kind === 'construct' || kind === 'describe') return SPEC_GRAPH_FORMATS
      if (kind === 'select') return TABULAR_FORMATS
      return []
    }
  }
}
