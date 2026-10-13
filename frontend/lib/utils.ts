import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type GraphExportFileType = {
  name: string
  contentType: string
  extension: string
}

export const GRAPH_EXPORT_FILE_TYPES: readonly GraphExportFileType[] = [
  { name: 'JSON-LD', contentType: 'application/ld+json', extension: 'jsonld' },
  { name: 'Turtle', contentType: 'text/turtle', extension: 'ttl' },
  { name: 'N-Triples', contentType: 'application/n-triples', extension: 'nt' },
  { name: 'N-Quads', contentType: 'application/n-quads', extension: 'nq' },
  { name: 'RDF/XML', contentType: 'application/rdf+xml', extension: 'rdf' }
] as const

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export const formatDuration = (duration: number) => {
  if (duration >= 1000) {
    const seconds = duration / 1000
    const precision = seconds >= 10 ? 0 : 2
    return `${seconds.toFixed(precision).replace(/\.0+$/, '')} s`
  }

  return `${duration} ms`
}

export function shortenUri(uri: string) {
  const match = uri.match(/[/#]([^/#]+)$/)
  return match ? match[1] : uri
}

const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#'

export function prefixedIri(
  iri: string,
  prefixes: Record<string, string>
): string {
  let bestPrefix: string | null = null
  let bestNamespace = ''
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace) && namespace.length > bestNamespace.length) {
      bestPrefix = prefix
      bestNamespace = namespace
    }
  }
  if (bestPrefix) {
    const local = iri.slice(bestNamespace.length)
    if (local.length > 0 && /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(local)) {
      return `${bestPrefix}:${local}`
    }
  }
  if (iri.startsWith(XSD_NAMESPACE)) {
    return `xsd:${iri.slice(XSD_NAMESPACE.length)}`
  }
  return iri
}
