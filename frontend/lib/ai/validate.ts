import 'server-only'

import { Generator, Parser } from 'sparqljs'
import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import { dialectFor, engineNamespacesFor } from '@/lib/ai/dialect'

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

const ALWAYS_ALLOWED_PROPERTIES = new Set([
  RDF_TYPE,
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://www.w3.org/2000/01/rdf-schema#comment',
  'http://www.w3.org/2000/01/rdf-schema#seeAlso',
  'http://www.w3.org/2002/07/owl#sameAs',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://www.w3.org/2004/02/skos/core#altLabel'
])

const ALWAYS_ALLOWED_CLASSES = new Set([
  'http://www.w3.org/2002/07/owl#Thing',
  'http://www.w3.org/2004/02/skos/core#Concept',
  'http://www.w3.org/2000/01/rdf-schema#Resource'
])

export interface ValidationResult {
  ok: boolean
  /** Query with the LIMIT cap applied, ready to execute. */
  query?: string
  issues: string[]
  /** True when validation capped the SELECT's LIMIT. */
  limitEnforced?: boolean
}

export interface ValidateOptions {
  /** Maximum LIMIT forced onto SELECT queries. */
  resultLimit: number
  /** When true, predicates and classes are checked against the profile. */
  checkVocabulary: boolean
}

type SparqlParser = InstanceType<typeof Parser>

function parserFor(profile: DatasetProfile | null): SparqlParser {
  return new Parser({
    prefixes: profile ? dialectFor(profile.provider).parserPrefixes : {}
  })
}

const generator = new Generator()

type IriTerm = { termType: string; value: string }

function isIriTerm(term: unknown): term is IriTerm {
  return (
    typeof term === 'object' &&
    term !== null &&
    (term as IriTerm).termType === 'NamedNode'
  )
}

function localName(iri: string): string {
  const withoutFragment = iri.split('#').pop() ?? iri
  const parts = withoutFragment.split('/')
  return parts[parts.length - 1] ?? iri
}

function suggestIris(iri: string, known: Set<string>): string[] {
  const wanted = localName(iri).toLowerCase()
  if (!wanted) return []
  const suggestions: string[] = []
  for (const candidate of known) {
    const name = localName(candidate).toLowerCase()
    if (name.startsWith(wanted) || wanted.startsWith(name)) {
      suggestions.push(candidate)
      if (suggestions.length >= 3) break
    }
  }
  return suggestions
}

function pathIris(value: unknown, sink: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) pathIris(item, sink)
    return
  }
  if (isIriTerm(value)) {
    sink.push(value.value)
    return
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    pathIris((value as { value: unknown }).value, sink)
  }
}

interface WalkState {
  predicates: Set<string>
  classes: Set<string>
  sawService: boolean
}

function walkPatterns(patterns: unknown, state: WalkState): void {
  if (!Array.isArray(patterns)) return
  for (const node of patterns) {
    if (typeof node !== 'object' || node === null) continue
    const pattern = node as {
      type?: string
      triples?: unknown
      patterns?: unknown
    }
    if (pattern.type === 'service') {
      state.sawService = true
      continue
    }
    if (pattern.type === 'bgp' && Array.isArray(pattern.triples)) {
      for (const triple of pattern.triples as Array<Record<string, unknown>>) {
        const predicate = triple.predicate
        if (isIriTerm(predicate)) {
          state.predicates.add(predicate.value)
          if (predicate.value === RDF_TYPE && isIriTerm(triple.object)) {
            state.classes.add(triple.object.value)
          }
        } else if (
          typeof predicate === 'object' &&
          predicate !== null &&
          'pathType' in predicate
        ) {
          const pathTerms: string[] = []
          pathIris(
            (predicate as unknown as { value: unknown }).value,
            pathTerms
          )
          for (const iri of pathTerms) state.predicates.add(iri)
        }
      }
      continue
    }
    if (pattern.patterns) {
      walkPatterns(pattern.patterns, state)
    }
  }
}

/**
 * Mutates the parsed AST to cap LIMIT, then re-serializes, so the
 * query that runs is always the sanitized form.
 */
export function validateSparqlQuery(
  input: string,
  profile: DatasetProfile | null,
  options: ValidateOptions
): ValidationResult {
  const issues: string[] = []

  let ast: ReturnType<SparqlParser['parse']>
  try {
    ast = parserFor(profile).parse(input)
  } catch (error) {
    return {
      ok: false,
      issues: [
        `The query does not parse as SPARQL: ${
          error instanceof Error ? error.message : 'syntax error'
        }`
      ]
    }
  }

  if (ast.type !== 'query') {
    return {
      ok: false,
      issues: [
        'Only read queries are allowed here. SPARQL Update is not supported.'
      ]
    }
  }

  const queryType = (ast as { queryType?: string }).queryType
  if (queryType !== 'SELECT' && queryType !== 'ASK') {
    return {
      ok: false,
      issues: [
        `Only SELECT and ASK queries are supported by this tool, not ${queryType ?? 'this query form'}. Rewrite the query as a SELECT.`
      ]
    }
  }

  const state: WalkState = {
    predicates: new Set(),
    classes: new Set(),
    sawService: false
  }
  const where = (ast as { where?: unknown }).where
  if (Array.isArray(where)) walkPatterns(where, state)

  if (state.sawService) {
    issues.push(
      'SERVICE (federated queries) are not allowed. Query this endpoint only.'
    )
  }

  if (options.checkVocabulary) {
    const knownPredicates = new Set(ALWAYS_ALLOWED_PROPERTIES)
    const knownClasses = new Set(ALWAYS_ALLOWED_CLASSES)
    for (const cls of profile?.classes ?? []) {
      knownClasses.add(cls.iri)
      for (const property of cls.properties) {
        knownPredicates.add(property.iri)
        for (const target of property.objectTypes) {
          if (target.kind === 'class') knownClasses.add(target.iri)
          if (target.kind === 'datatype') knownPredicates.add(target.iri)
        }
      }
    }
    for (const property of profile?.looseProperties ?? []) {
      knownPredicates.add(property.iri)
    }

    const engineNamespaces = profile
      ? engineNamespacesFor(profile.provider)
      : []

    for (const predicate of state.predicates) {
      if (
        knownPredicates.has(predicate) ||
        engineNamespaces.some((namespace) => predicate.startsWith(namespace))
      ) {
        continue
      }
      const suggestions = suggestIris(predicate, knownPredicates)
      issues.push(
        `Predicate <${predicate}> is not used in this dataset.${
          suggestions.length > 0
            ? ` Known predicates with a similar name: ${suggestions
                .map((iri) => `<${iri}>`)
                .join(', ')}.`
            : ' Use only predicates listed in the dataset profile.'
        }`
      )
    }
    for (const cls of state.classes) {
      if (!knownClasses.has(cls)) {
        const suggestions = suggestIris(cls, knownClasses)
        issues.push(
          `Class <${cls}> has no instances in this dataset.${
            suggestions.length > 0
              ? ` Known classes with a similar name: ${suggestions
                  .map((iri) => `<${iri}>`)
                  .join(', ')}.`
              : ' Use only classes listed in the dataset profile.'
          }`
        )
      }
    }
  }

  let limitEnforced = false
  if (queryType === 'SELECT') {
    const select = ast as { limit?: number }
    if (select.limit === undefined || select.limit > options.resultLimit) {
      select.limit = options.resultLimit
      limitEnforced = true
    }
  }

  let query: string
  try {
    query = generator.stringify(ast)
  } catch {
    issues.push('The query could not be re-serialized after validation.')
    return { ok: issues.length === 0, issues }
  }

  // The parser learned these shorthands from the dialect, but engines such
  // as Virtuoso reserve them and reject any query that declares them.
  if (profile) {
    for (const [prefix, iri] of Object.entries(
      dialectFor(profile.provider).parserPrefixes
    )) {
      query = query.split(`PREFIX ${prefix}: <${iri}>\n`).join('')
    }
  }

  return { ok: issues.length === 0, query, issues, limitEnforced }
}
