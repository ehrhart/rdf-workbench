import 'server-only'

import { buildExcerpt } from '@/lib/sparql/excerpt'
import type { ResourceSuggestion } from '@/types'
import { qleverSparqlTransport } from './sparql'

const TEXT_SEARCH_PREFIX = 'https://qlever.cs.uni-freiburg.de/textSearch/'
const QL_HAS_WORD = 'http://qlever.cs.uni-freiburg.de/builtin-functions/'

function escapeTerm(term: string): string {
  return term.replace(/(["\\])/g, '\\$1')
}

function suggestWords(searchTerm: string): Promise<string[]> {
  const escaped = escapeTerm(searchTerm)
  return qleverSparqlTransport
    .execute(`
      PREFIX textSearch: <${TEXT_SEARCH_PREFIX}>
      SELECT ?w WHERE {
        SERVICE textSearch: {
          ?t textSearch:contains [
            textSearch:word "${escaped}*" ;
            textSearch:prefix-match ?w ;
            textSearch:score ?score
          ] .
        }
      }
      GROUP BY ?w
      ORDER BY DESC(SUM(?score))
      LIMIT 8
    `)
    .then((result) => {
      if (result.kind !== 'bindings') return []
      return result.bindings
        .map((binding) => binding.w?.value ?? '')
        .filter(Boolean)
    })
}

export async function getResourceSuggestions(
  searchTerm: string
): Promise<ResourceSuggestion[]> {
  if (!searchTerm || searchTerm.length < 2) return []

  const words = await suggestWords(searchTerm).catch(() => [] as string[])
  if (words.length === 0) return searchByLabel(searchTerm)

  const valueClause = words.map((word) => `"${escapeTerm(word)}"`).join(' ')

  const result = await qleverSparqlTransport.execute(`
    PREFIX ql: <${QL_HAS_WORD}>
    SELECT DISTINCT ?subject ?text ?w ?score WHERE {
      VALUES ?w { ${valueClause} }
      GRAPH ?score { ?text ql:has-word ?w . }
      ?subject ?p ?text .
    }
    ORDER BY DESC(?score)
    LIMIT 10
  `)
  if (result.kind !== 'bindings') return searchByLabel(searchTerm)

  const suggestions: ResourceSuggestion[] = []
  const seen = new Set<string>()

  for (const binding of result.bindings) {
    const subject = binding.subject?.value ?? ''
    if (!subject || seen.has(subject)) continue
    seen.add(subject)

    suggestions.push({
      id: String(suggestions.length),
      resource: subject,
      excerpt: buildExcerpt(binding.text?.value ?? '', binding.w?.value ?? ''),
      score: parseFloat(binding.score?.value || '0'),
      rank: suggestions.length,
      graph: ''
    })
  }

  return suggestions
}

const LABEL_SCAN_POOL = 100

/**
 * Fallback for endpoints whose QLever index has no text records: the
 * SERVICE text search silently returns nothing (or forwards to a hosted
 * service that refuses), and the ql:contains-* builtins crash the engine.
 * A bounded rdfs:label scan still answers it, so the ranking that the
 * missing index would have provided happens client-side.
 */
async function searchByLabel(
  searchTerm: string
): Promise<ResourceSuggestion[]> {
  const result = await qleverSparqlTransport
    .execute(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?subject ?label WHERE {
      ?subject rdfs:label ?label .
      FILTER(CONTAINS(LCASE(?label), "${escapeTerm(searchTerm.toLowerCase())}"))
    }
    LIMIT ${LABEL_SCAN_POOL}
  `)
    .catch(() => null)
  if (result?.kind !== 'bindings') return []

  const lowered = searchTerm.toLowerCase()
  const ranked = [...result.bindings]
    .map((binding) => {
      const label = binding.label?.value ?? ''
      const loweredLabel = label.toLowerCase()
      return {
        subject: binding.subject?.value ?? '',
        label,
        quality:
          loweredLabel === lowered
            ? 0
            : loweredLabel.startsWith(lowered)
              ? 1
              : loweredLabel.includes(lowered)
                ? 2
                : 3
      }
    })
    .filter((row) => row.subject && row.quality < 3)
    .sort((a, b) => a.quality - b.quality || a.label.length - b.label.length)

  const suggestions: ResourceSuggestion[] = []
  const seen = new Set<string>()
  for (const row of ranked) {
    if (seen.has(row.subject)) continue
    seen.add(row.subject)
    suggestions.push({
      id: String(suggestions.length),
      resource: row.subject,
      excerpt: buildExcerpt(row.label, searchTerm),
      score: ranked.length - suggestions.length,
      rank: suggestions.length,
      graph: ''
    })
    if (suggestions.length >= 8) break
  }
  return suggestions
}
