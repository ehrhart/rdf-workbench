import { QueryError } from '@/lib/errors'
import type { TriplestoreProvider } from '@/lib/runtime/contracts'

export const RESERVED_WORKBENCH_PATHS = [
  'admin',
  'api',
  'fulltext-index',
  'graphs',
  'graphs-visualizations',
  'health',
  'import',
  'isql',
  'login',
  'logout',
  'monitor',
  'namespaces',
  'resource',
  'sparql',
  '_next'
] as const

export const RESERVED_PROVIDER_PATHS: Record<
  TriplestoreProvider,
  readonly string[]
> = {
  virtuoso: ['sparql', 'fct', 'conductor', 'DAV', 'describe'],
  qlever: [],
  oxigraph: [],
  generic: []
}

const MAX_PATH_LENGTH = 64

function isServeablePathSegment(segment: string): boolean {
  if (segment.includes('/') || segment.includes('%') || segment.startsWith('.'))
    return false
  if (segment !== segment.toLowerCase()) return false
  return new URL(`http://x/${segment}`).pathname === `/${segment}`
}

export function reservedPathsFor(provider: TriplestoreProvider): string[] {
  return [
    ...new Set([
      ...RESERVED_WORKBENCH_PATHS,
      ...RESERVED_PROVIDER_PATHS[provider]
    ])
  ]
}

export function dereferencePathFormatIssue(rawPath: string): string | null {
  const path = rawPath.trim()
  if (!path) return 'A path is required'
  if (path.length > MAX_PATH_LENGTH) {
    return `Path must be at most ${MAX_PATH_LENGTH} characters`
  }
  if (!isServeablePathSegment(path)) {
    return 'Path must be a lowercase URL path segment without separators, dot prefixes, or characters that require percent-encoding'
  }
  return null
}

export function dereferencePathIssue(
  rawPath: string,
  reservedPaths: readonly string[]
): string | null {
  const formatIssue = dereferencePathFormatIssue(rawPath)
  if (formatIssue) return formatIssue
  const path = rawPath.trim()
  if (reservedPaths.includes(path)) {
    return `Path "/${path}" is reserved`
  }
  return null
}

export function validateDereferencePathFormat(rawPath: string): string {
  const path = rawPath.trim()
  const issue = dereferencePathFormatIssue(path)
  if (issue) throw new QueryError(issue)
  return path
}

export function validateDereferencePath(
  rawPath: string,
  provider: TriplestoreProvider
): string {
  const issue = dereferencePathIssue(rawPath, reservedPathsFor(provider))
  if (issue) throw new QueryError(issue)
  return rawPath.trim()
}

export interface ParsedDereferencePaths {
  paths: string[]
  skipped: Array<{ entry: string; reason: string }>
}

const LIST_SEPARATOR = /[\s,]+/

export function parseDereferencePaths(
  raw: string | undefined,
  provider: TriplestoreProvider
): ParsedDereferencePaths {
  const entries = new Set(raw?.split(LIST_SEPARATOR).filter(Boolean) ?? [])
  const paths: string[] = []
  const skipped: Array<{ entry: string; reason: string }> = []
  for (const entry of entries) {
    try {
      paths.push(validateDereferencePath(entry, provider))
    } catch (error) {
      skipped.push({
        entry,
        reason: error instanceof Error ? error.message : 'Invalid path'
      })
    }
  }
  return { paths, skipped }
}
