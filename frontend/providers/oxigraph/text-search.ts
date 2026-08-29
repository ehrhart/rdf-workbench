import 'server-only'

import { buildExcerpt } from '@/lib/sparql/excerpt'
import type { ResourceSuggestion } from '@/types'
import { oxigraphSparqlTransport } from './sparql'

function escapeTerm(term: string): string {
  return term.replace(/(["\\])/g, '\\$1')
}

export async function getResourceSuggestions(
  searchTerm: string
): Promise<ResourceSuggestion[]> {
  if (!searchTerm || searchTerm.length < 2) return []

  const escaped = escapeTerm(searchTerm)
  const result = await oxigraphSparqlTransport.execute(`
    SELECT DISTINCT ?resource ?text WHERE {
      GRAPH ?graph {
        ?resource ?predicate ?text .
        FILTER(CONTAINS(LCASE(STR(?text)), LCASE("${escaped}")))
      }
    }
    LIMIT 10
  `)
  if (result.kind !== 'bindings') return []

  return result.bindings
    .map((binding, index) => ({
      id: String(index),
      resource: binding.resource?.value ?? '',
      excerpt: buildExcerpt(binding.text?.value ?? '', searchTerm),
      score: 0,
      rank: index,
      graph: ''
    }))
    .filter((suggestion) => suggestion.resource.length > 0)
}
