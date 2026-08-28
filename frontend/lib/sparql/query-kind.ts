import { Parser } from 'sparqljs'
import type { SparqlQueryKind } from '@/lib/runtime/contracts'

export function detectSparqlQueryKind(query: string): SparqlQueryKind {
  try {
    const parsed = new Parser({ skipUngroupedVariableCheck: true }).parse(query)
    if ('queryType' in parsed && typeof parsed.queryType === 'string') {
      const kind = parsed.queryType.toLowerCase()
      if (
        kind === 'select' ||
        kind === 'ask' ||
        kind === 'construct' ||
        kind === 'describe'
      ) {
        return kind
      }
    }
    if ('updates' in parsed) return 'update'
  } catch {
    return 'unknown'
  }
  return 'unknown'
}
