import 'server-only'

import { QueryError } from '@/lib/errors'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { oxigraphSparqlTransport } from './sparql'

const TRIPLE_FORMATS = new Set([
  'text/turtle',
  'application/n-triples',
  'application/rdf+xml'
])

function config() {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'oxigraph') {
    throw new Error('Oxigraph store requested in a different deployment')
  }
  return value
}

function storeEndpoint(): URL {
  const endpoint = new URL(config().SPARQL_ENDPOINT)
  endpoint.pathname = endpoint.pathname.replace(/\/[^/]*$/, '/store')
  return endpoint
}

export async function importFile(
  content: BodyInit,
  format: string,
  graph?: string
): Promise<void> {
  if (graph && !TRIPLE_FORMATS.has(format)) {
    throw new QueryError(
      'Per-graph loading requires Turtle, N-Triples, or RDF/XML'
    )
  }
  const url = storeEndpoint()
  if (graph) url.searchParams.set('graph', graph)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': format },
    body: content,
    cache: 'no-store'
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      body || `Oxigraph store rejected the file with status ${response.status}`
    )
  }
}

export async function importUrl(url: string, graph?: string): Promise<void> {
  const update = graph ? `LOAD <${url}> INTO GRAPH <${graph}>` : `LOAD <${url}>`
  await oxigraphSparqlTransport.execute(update, { kind: 'update' })
}

export async function importSnippet(
  turtle: string,
  graph?: string
): Promise<void> {
  await importFile(turtle, 'text/turtle', graph)
}

export async function exportGraph(
  uri: string,
  format: string
): Promise<Response> {
  const url = storeEndpoint()
  url.searchParams.set('graph', uri)
  return fetch(url, {
    headers: { Accept: format },
    cache: 'no-store'
  })
}
