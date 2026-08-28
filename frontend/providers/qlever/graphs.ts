import 'server-only'

import type { GraphReader } from '@/lib/runtime/contracts'
import { requireBindingsResult } from '@/lib/sparql/results'
import type { NamedGraph } from '@/types'
import { qleverSparqlTransport } from './sparql'

export async function listQleverNamedGraphs(): Promise<NamedGraph[]> {
  const result = requireBindingsResult(
    await qleverSparqlTransport.execute(`
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

export const qleverGraphReader: GraphReader = {
  listNamedGraphs: listQleverNamedGraphs
}
