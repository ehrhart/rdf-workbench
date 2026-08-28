import {
  buildBlankNodeFilterClause,
  buildRoleFilterClause
} from '@/lib/sparql/resource-filters'
import type { SparqlBinding, SparqlBindingValue } from '@/types'
import { TRIPLE_FETCH_LIMIT } from './constants'
import type { ResourceRole, Triple } from './types'

/**
 * Generates a SPARQL query to fetch triples for a resource based on its role
 * @param resourceUri - The URI of the resource
 * @param role - The role of the resource (subject, predicate, object, context, or all)
 * @param showBlankNodes - Whether to show blank nodes
 * @returns SPARQL query string
 */
export const generateTriplesQuery = (
  resourceUri: string,
  role: ResourceRole,
  showBlankNodes: boolean
): string => {
  const limitClause = `LIMIT ${TRIPLE_FETCH_LIMIT}`
  const roleFilter = buildRoleFilterClause(role, { graphVar: '?context' })
  const blankNodeFilter = buildBlankNodeFilterClause(showBlankNodes, {
    graphVar: '?context'
  })

  return `SELECT DISTINCT ?subject ?predicate ?object ?context WHERE {
    VALUES ?resource { <${resourceUri}> }
    GRAPH ?context { ?subject ?predicate ?object }
    ${roleFilter}
    ${blankNodeFilter}
  } ${limitClause}`
}

/**
 * Parses normalized SPARQL bindings into the Triple structure
 * @param bindings - Raw SPARQL query result bindings
 * @returns Array of parsed Triple objects
 */
type SparqlTripleBinding = Partial<
  Record<'subject' | 'predicate' | 'object' | 'context', SparqlBindingValue>
>

const toRdfNode = (binding?: SparqlBindingValue): Triple['subject'] => {
  const datatype =
    binding && 'datatype' in binding ? binding.datatype : undefined
  const language =
    binding && 'xml:lang' in binding ? binding['xml:lang'] : undefined

  return {
    value: binding?.value ?? '',
    type: (binding?.type ?? 'literal') as Triple['subject']['type'],
    datatype,
    language
  }
}

export const parseTripleResults = (
  bindings: SparqlBinding[] = []
): Triple[] => {
  if (!bindings.length) {
    return []
  }

  return bindings.map((binding) => {
    const tripleBinding = binding as SparqlTripleBinding

    return {
      subject: toRdfNode(tripleBinding.subject),
      predicate: toRdfNode(tripleBinding.predicate),
      object: toRdfNode(tripleBinding.object),
      context: toRdfNode(tripleBinding.context)
    }
  })
}
