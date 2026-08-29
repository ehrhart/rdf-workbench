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
  oxigraph: []
}

const PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_PATH_LENGTH = 64

export function reservedPathsFor(provider: TriplestoreProvider): string[] {
  return [
    ...new Set([
      ...RESERVED_WORKBENCH_PATHS,
      ...RESERVED_PROVIDER_PATHS[provider]
    ])
  ]
}

export function validateDereferencePathFormat(rawPath: string): string {
  const path = rawPath.trim()
  if (!path) throw new QueryError('A path is required')
  if (path.length > MAX_PATH_LENGTH) {
    throw new QueryError(`Path must be at most ${MAX_PATH_LENGTH} characters`)
  }
  if (!PATH_PATTERN.test(path)) {
    throw new QueryError(
      'Path must be a lowercase slug using letters, digits, and hyphens'
    )
  }
  return path
}

export function validateDereferencePath(
  rawPath: string,
  provider: TriplestoreProvider
): string {
  const path = validateDereferencePathFormat(rawPath)
  if (reservedPathsFor(provider).includes(path)) {
    throw new QueryError(`Path "/${path}" is reserved`)
  }
  return path
}
