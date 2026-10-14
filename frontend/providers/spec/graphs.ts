import 'server-only'

import type { GraphReader, SparqlTransport } from '@/lib/runtime/contracts'
import { requireBindingsResult } from '@/lib/sparql/results'
import type { NamedGraph } from '@/types'

export function createSpecGraphReader(sparql: SparqlTransport): GraphReader {
  return {
    async listNamedGraphs(): Promise<NamedGraph[]> {
      const result = requireBindingsResult(
        await sparql.execute(`
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
  }
}
