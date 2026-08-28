import 'server-only'

import type { ResourceSuggestion } from '@/types'
import { qleverSparqlTransport } from './sparql'

const TEXT_SEARCH_PREFIX = 'https://qlever.cs.uni-freiburg.de/textSearch/'
const QL_HAS_WORD = 'http://qlever.cs.uni-freiburg.de/builtin-functions/'

function escapeTerm(term: string): string {
  return term.replace(/(["\\])/g, '\\$1')
}

function buildExcerpt(text: string, word: string, radius = 40): string {
  if (!text) return ''
  if (!word) return text.slice(0, 160)

  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(word.toLowerCase())
  if (index === -1) return text.slice(0, 160)

  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + word.length + radius)
  const matchEnd = index + word.length

  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const core =
    text.slice(start, index) +
    `<b>${text.slice(index, matchEnd)}</b>` +
    text.slice(matchEnd, end)

  return `${prefix}${core}${suffix}`
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

  const words = await suggestWords(searchTerm)
  if (words.length === 0) return []

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
  if (result.kind !== 'bindings') return []

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
