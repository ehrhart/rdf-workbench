import 'server-only'

import type { DatasetProfile } from '@/lib/ai/dataset-profile'
import type { WorkbenchRuntime } from '@/lib/runtime/contracts'
import type { SparqlBindingValue } from '@/types'

export type VocabularyTermKind = 'class' | 'predicate'

export interface VocabularyHit {
  iri: string
  kind: VocabularyTermKind
  label: string | null
}

export interface VocabularySearchResult {
  hits: VocabularyHit[]
  note?: string
}

const SEARCH_RESULT_LIMIT = 12
const PROBE_LIMIT = 24
const PROBE_TIMEOUT_MS = 5000

const CLASS_TYPE_IRIS = new Set([
  'http://www.w3.org/2000/01/rdf-schema#Class',
  'http://www.w3.org/2002/07/owl#Class'
])

const PROPERTY_TYPE_IRIS = new Set([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
  'http://www.w3.org/2002/07/owl#ObjectProperty',
  'http://www.w3.org/2002/07/owl#DatatypeProperty',
  'http://www.w3.org/2002/07/owl#AnnotationProperty'
])

function localName(iri: string): string {
  const separator = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'))
  return separator === -1 ? iri : iri.slice(separator + 1)
}

function bindingIri(value: SparqlBindingValue | undefined): string | null {
  if (!value || value.type === 'bnode' || value.type === 'literal') return null
  return value.value
}

function profileHits(
  profile: DatasetProfile,
  term: string,
  kindFilter: VocabularyTermKind | 'any'
): VocabularyHit[] {
  const hits: VocabularyHit[] = []
  const seen = new Set<string>()
  const add = (iri: string, kind: VocabularyTermKind, label: string | null) => {
    if (seen.has(iri)) return
    if (kindFilter !== 'any' && kind !== kindFilter) return
    if (!localName(iri).toLowerCase().includes(term)) return
    seen.add(iri)
    hits.push({ iri, kind, label })
  }
  for (const cls of profile.classes) {
    add(cls.iri, 'class', cls.label)
    for (const property of cls.properties) add(property.iri, 'predicate', null)
  }
  for (const property of profile.looseProperties) {
    add(property.iri, 'predicate', null)
  }
  return hits
}

async function endpointHits(
  runtime: WorkbenchRuntime,
  term: string,
  kindFilter: VocabularyTermKind | 'any',
  signal?: AbortSignal
): Promise<VocabularyHit[]> {
  const classTypes = 'rdfs:Class, owl:Class'
  const propertyTypes =
    'rdf:Property, owl:ObjectProperty, owl:DatatypeProperty, owl:AnnotationProperty'
  const types =
    kindFilter === 'class'
      ? classTypes
      : kindFilter === 'predicate'
        ? propertyTypes
        : `${classTypes}, ${propertyTypes}`
  const result = await runtime.sparql.execute(
    `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?entity ?entityType ?label WHERE {
  ?entity a ?entityType .
  FILTER(?entityType IN (${types}))
  FILTER(CONTAINS(LCASE(STR(?entity)), "${term}"))
  OPTIONAL {
    ?entity rdfs:label ?anyLabel .
    FILTER(LANG(?anyLabel) = "en" || LANG(?anyLabel) = "")
  }
}
LIMIT ${PROBE_LIMIT}`,
    { timeoutMs: PROBE_TIMEOUT_MS, signal }
  )
  if (result.kind !== 'bindings') {
    throw new Error(`unexpected ${result.kind} vocabulary search result`)
  }

  const hits: VocabularyHit[] = []
  const seen = new Set<string>()
  for (const binding of result.bindings) {
    const iri = bindingIri(binding.entity)
    const typeIri = bindingIri(binding.entityType)
    if (!iri || !typeIri || seen.has(iri)) continue
    const kind = CLASS_TYPE_IRIS.has(typeIri)
      ? 'class'
      : PROPERTY_TYPE_IRIS.has(typeIri)
        ? 'predicate'
        : null
    if (!kind) continue
    seen.add(iri)
    const label = binding.label
    hits.push({
      iri,
      kind,
      label: label && label.type === 'literal' ? label.value : null
    })
  }
  return hits
}

export async function searchVocabulary(
  runtime: WorkbenchRuntime,
  profile: DatasetProfile | null,
  term: string,
  options?: { kind?: VocabularyTermKind | 'any'; signal?: AbortSignal }
): Promise<VocabularySearchResult> {
  const query = term.trim().toLowerCase()
  if (query.length < 2) {
    return { hits: [], note: 'Use a search term of at least two characters.' }
  }
  if (query.includes('"') || query.includes('\\')) {
    return {
      hits: [],
      note: 'Search terms cannot contain quotes or backslashes.'
    }
  }
  const kindFilter = options?.kind ?? 'any'

  const hits = profile ? profileHits(profile, query, kindFilter) : []
  if (hits.length >= SEARCH_RESULT_LIMIT) {
    return { hits: hits.slice(0, SEARCH_RESULT_LIMIT) }
  }
  if (options?.signal?.aborted) return { hits }

  try {
    const probed = await endpointHits(
      runtime,
      query,
      kindFilter,
      options?.signal
    )
    const known = new Set(hits.map((hit) => hit.iri))
    for (const hit of probed) {
      if (!known.has(hit.iri)) hits.push(hit)
    }
  } catch (error) {
    console.warn('[ask] vocabulary search failed:', error)
    return {
      hits,
      note: hits.length === 0 ? 'Endpoint vocabulary search failed.' : undefined
    }
  }

  return {
    hits: hits.slice(0, SEARCH_RESULT_LIMIT),
    note:
      hits.length === 0
        ? `No classes or predicates matched "${term.trim()}".`
        : undefined
  }
}
