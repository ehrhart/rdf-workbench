import type { DownloadFormat } from '@/lib/runtime/contracts'

export const TABULAR_FORMATS: readonly DownloadFormat[] = [
  {
    label: 'JSON',
    mime: 'application/sparql-results+json',
    extension: 'json'
  },
  {
    label: 'XML',
    mime: 'application/sparql-results+xml',
    extension: 'xml'
  },
  { label: 'CSV', mime: 'text/csv', extension: 'csv' },
  {
    label: 'TSV',
    mime: 'text/tab-separated-values',
    extension: 'tsv'
  }
]

export const GRAPH_FORMATS: readonly DownloadFormat[] = [
  { label: 'Turtle', mime: 'text/turtle', extension: 'ttl' },
  { label: 'N-Triples', mime: 'application/n-triples', extension: 'nt' },
  { label: 'N-Quads', mime: 'application/n-quads', extension: 'nq' },
  { label: 'JSON-LD', mime: 'application/ld+json', extension: 'jsonld' },
  { label: 'RDF/XML', mime: 'application/rdf+xml', extension: 'rdf' }
]

export const SPARQL_RESULT_MEDIA_TYPES: readonly string[] = [
  ...TABULAR_FORMATS.map((format) => format.mime),
  ...GRAPH_FORMATS.map((format) => format.mime)
]

export function isSparqlResultAccept(accept: string | null): boolean {
  if (!accept) return false
  const normalized = accept.toLowerCase()
  return SPARQL_RESULT_MEDIA_TYPES.some((mime) => normalized.includes(mime))
}

export function isSparqlResultFormat(format: string | null): boolean {
  if (!format) return false
  const [mime] = format.split(';')
  const normalized = mime?.trim().toLowerCase() ?? ''
  return SPARQL_RESULT_MEDIA_TYPES.includes(normalized)
}

export function isSparqlQueryBody(contentType: string | null): boolean {
  if (!contentType) return false
  const normalized = contentType.toLowerCase()
  return (
    normalized.includes('application/x-www-form-urlencoded') ||
    normalized.includes('application/sparql-query') ||
    normalized.includes('application/json')
  )
}

export function acceptsHtml(accept: string | null): boolean {
  if (!accept) return true
  const normalized = accept.toLowerCase()
  if (normalized.includes('text/html')) return true
  const requested = parseAccept(normalized)
  return requested.length === 0 || requested.every((mime) => mime === '*/*')
}

export function parseAccept(accept: string | null): string[] {
  if (!accept) return []
  return accept
    .split(',')
    .map((token) => {
      const [mime] = token.split(';')
      return mime?.trim().toLowerCase() ?? ''
    })
    .filter(Boolean)
}
