import { Parser } from 'sparqljs'
import type { SparqlQueryKind } from '@/lib/runtime/contracts'

export function detectQueryKind(query: string): SparqlQueryKind {
  try {
    const parsed = new Parser({ skipUngroupedVariableCheck: true }).parse(query)
    if ('queryType' in parsed) {
      return parsed.queryType.toLowerCase() as SparqlQueryKind
    }
    if ('updates' in parsed) {
      return 'update'
    }
  } catch {}
  return 'unknown'
}
