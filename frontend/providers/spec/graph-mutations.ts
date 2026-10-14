import 'server-only'

import type { GraphMutations, SparqlTransport } from '@/lib/runtime/contracts'
import { requireBindingsResult } from '@/lib/sparql/results'
import { assertSafeSparqlIri } from './iri'

export function createSpecGraphMutations(
  sparql: SparqlTransport
): GraphMutations {
  return {
    async getGraphTripleCount(uri: string): Promise<number> {
      assertSafeSparqlIri(uri, 'Graph IRI')
      const result = requireBindingsResult(
        await sparql.execute(
          `SELECT (COUNT(*) AS ?triples) WHERE { GRAPH <${uri}> { ?s ?p ?o } }`
        )
      )
      return Number.parseInt(result.bindings[0]?.triples?.value ?? '0', 10) || 0
    },

    async deleteGraph(uri: string): Promise<void> {
      assertSafeSparqlIri(uri, 'Graph IRI')
      await sparql.execute(`DROP GRAPH <${uri}>`, { kind: 'update' })
    },

    async clearRepository(): Promise<void> {
      await sparql.execute('DROP ALL', { kind: 'update' })
    }
  }
}
