import type {
  RawSparqlBindingValue,
  RawSparqlJsonResult,
  SparqlBinding,
  SparqlBindingValue,
  SparqlQueryResult
} from '@/types'

function normalizeBindingValue(
  value: RawSparqlBindingValue
): SparqlBindingValue {
  if (value.type !== 'typed-literal') return value

  return {
    type: 'literal',
    value: value.value,
    datatype: value.datatype
  }
}

export function normalizeSparqlJsonResult(value: unknown): SparqlQueryResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid SPARQL result format')
  }

  const raw = value as RawSparqlJsonResult
  if (typeof raw.boolean === 'boolean') {
    return { kind: 'boolean', value: raw.boolean }
  }

  if (!raw.head || !Array.isArray(raw.head.vars)) {
    throw new Error('Invalid SPARQL result variables')
  }
  if (!raw.results || !Array.isArray(raw.results.bindings)) {
    throw new Error('Invalid SPARQL result bindings')
  }

  const bindings: SparqlBinding[] = raw.results.bindings.map((binding) =>
    Object.fromEntries(
      Object.entries(binding).map(([key, bindingValue]) => [
        key,
        normalizeBindingValue(bindingValue)
      ])
    )
  )

  return {
    kind: 'bindings',
    variables: raw.head.vars,
    bindings,
    meta: raw.meta
  }
}

export function requireBindingsResult(result: SparqlQueryResult) {
  if (result.kind !== 'bindings') {
    throw new Error('Expected a SPARQL bindings result')
  }
  return result
}
