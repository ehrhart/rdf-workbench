import 'server-only'

import { requireBindingsResult } from '@/lib/sparql/results'
import { oxigraphSparqlTransport } from './sparql'

export async function getGraphTripleCount(uri: string): Promise<number> {
  const result = requireBindingsResult(
    await oxigraphSparqlTransport.execute(
      `SELECT (COUNT(*) AS ?triples) WHERE { GRAPH <${uri}> { ?s ?p ?o } }`
    )
  )
  return Number.parseInt(result.bindings[0]?.triples?.value ?? '0', 10) || 0
}

export async function deleteGraph(uri: string): Promise<void> {
  await oxigraphSparqlTransport.execute(`DROP GRAPH <${uri}>`, {
    kind: 'update'
  })
}

export async function clearRepository(): Promise<void> {
  await oxigraphSparqlTransport.execute('DROP ALL', { kind: 'update' })
}
