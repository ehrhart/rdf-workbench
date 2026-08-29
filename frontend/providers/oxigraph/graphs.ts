import 'server-only'

import type { GraphReader } from '@/lib/runtime/contracts'
import { requireBindingsResult } from '@/lib/sparql/results'
import type { NamedGraph } from '@/types'
import { oxigraphSparqlTransport } from './sparql'

export async function listOxigraphNamedGraphs(): Promise<NamedGraph[]> {
  const result = requireBindingsResult(
    await oxigraphSparqlTransport.execute(`
      SELECT ?graph (COUNT(*) AS ?triples)
      WHERE { GRAPH ?graph { ?subject ?predicate ?object } }
      GROUP BY ?graph
      ORDER BY ?graph
    `)
  )

  return result.bindings
    .map((binding) => ({
      uri: binding.graph?.value ?? '',
      tripleCount: Number.parseInt(binding.triples?.value ?? '0', 10) || 0
    }))
    .filter((graph) => graph.uri.length > 0)
}

export const oxigraphGraphReader: GraphReader = {
  listNamedGraphs: listOxigraphNamedGraphs
}
