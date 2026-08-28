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
