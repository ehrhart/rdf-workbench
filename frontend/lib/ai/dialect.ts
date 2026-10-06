import 'server-only'

import type { TriplestoreProvider } from '@/lib/runtime/contracts'

interface Dialect {
  /**
   * Namespaces the engine resolves itself, such as virtual predicates and
   * magic services. These never occur as stored triples, so a dataset
   * profile built by introspecting the data can never list them.
   */
  engineNamespaces: string[]
  /**
   * Prefixes taught to the query parser. Virtuoso accepts `bif:` only as a
   * reserved built-in and rejects any query that declares it, so the parser
   * must know the shorthand without the query carrying a declaration.
   */
  parserPrefixes: Record<string, string>
  note: string
}

const DIALECTS: Record<TriplestoreProvider, Dialect> = {
  qlever: {
    engineNamespaces: [
      'http://qlever.cs.uni-freiburg.de/builtin-functions/',
      'https://qlever.cs.uni-freiburg.de/textSearch/'
    ],
    parserPrefixes: {},
    note: 'Engine: QLever. Full SPARQL 1.1 SELECT support and fast aggregation. Full-text search uses ql:contains-word / ql:contains-entity, but prefer the search_entities tool instead.'
  },
  virtuoso: {
    engineNamespaces: ['http://www.openlinksw.com/schema/bif#'],
    parserPrefixes: { bif: 'http://www.openlinksw.com/schema/bif#' },
    note: 'Engine: Virtuoso. SPARQL 1.1 with Virtuoso extensions. Full-text search uses the `bif:contains` predicate, e.g. `?o bif:contains "term"`. Write it without declaring a bif: prefix. Prefer the search_entities tool instead.'
  },
  oxigraph: {
    engineNamespaces: [],
    parserPrefixes: {},
    note: 'Engine: Oxigraph. Strict SPARQL 1.1. No full-text search support; resolve entities with the search_entities tool, or probe a plausible canonical IRI as a constant in a triple pattern. FILTER with STRSTARTS/CONTAINS is a last resort for small or pre-filtered sets.'
  }
}

export function dialectFor(provider: TriplestoreProvider): Dialect {
  return DIALECTS[provider]
}

export function engineNamespacesFor(provider: TriplestoreProvider): string[] {
  return DIALECTS[provider].engineNamespaces
}

export const DIALECT_NOTES: Record<TriplestoreProvider, string> = {
  qlever: DIALECTS.qlever.note,
  virtuoso: DIALECTS.virtuoso.note,
  oxigraph: DIALECTS.oxigraph.note
}
