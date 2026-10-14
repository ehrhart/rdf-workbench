import 'server-only'

import { assertSafeSparqlIri } from '@/providers/spec/iri'
import { genericSparqlTransport } from './sparql'

export async function importUrl(url: string, graph?: string): Promise<void> {
  assertSafeSparqlIri(url, 'Source URL')
  if (graph) assertSafeSparqlIri(graph, 'Target graph')

  const query = graph ? `LOAD <${url}> INTO GRAPH <${graph}>` : `LOAD <${url}>`
  await genericSparqlTransport.execute(query, { kind: 'update' })
}
