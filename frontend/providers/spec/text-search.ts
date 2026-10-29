import 'server-only'

import type {
  SparqlTransport,
  TextSearchAdapter
} from '@/lib/runtime/contracts'
import { buildExcerpt } from '@/lib/sparql/excerpt'
import { dedupeSuggestions } from '@/lib/sparql/suggestions'
import type { ResourceSuggestion } from '@/types'

function escapeTerm(term: string): string {
  return term.replace(/(["\\])/g, '\\$1')
}

export function createSpecTextSearch(
  sparql: SparqlTransport
): TextSearchAdapter {
  return {
    async getResourceSuggestions(searchTerm): Promise<ResourceSuggestion[]> {
      if (!searchTerm || searchTerm.length < 2) return []

      const escaped = escapeTerm(searchTerm)
      const result = await sparql.execute(`
        SELECT DISTINCT ?resource ?text WHERE {
          GRAPH ?graph {
            ?resource ?predicate ?text .
            FILTER(CONTAINS(LCASE(STR(?text)), LCASE("${escaped}")))
          }
        }
        LIMIT 25
      `)
      if (result.kind !== 'bindings') return []

      return dedupeSuggestions(
        result.bindings.map((binding) => ({
          id: '',
          resource: binding.resource?.value ?? '',
          excerpt: buildExcerpt(binding.text?.value ?? '', searchTerm),
          score: 0,
          rank: 0,
          graph: ''
        }))
      ).map((suggestion, index) => ({
        ...suggestion,
        id: String(index),
        rank: index
      }))
    }
  }
}
