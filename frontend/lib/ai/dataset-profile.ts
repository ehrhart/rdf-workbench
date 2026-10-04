import 'server-only'

import { type AiConfig, getAiConfig } from '@/lib/ai/config'
import { requireSafeIri } from '@/lib/ai/iri'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type { TriplestoreProvider } from '@/lib/runtime/contracts'
import type { NamedGraph, SparqlBindingValue } from '@/types'

export interface ProfileObjectTarget {
  kind: 'class' | 'datatype' | 'bnode'
  /** Full IRI for classes and datatypes, short label for blank nodes. */
  iri: string
  count: number
}

export interface ProfileProperty {
  iri: string
  count: number
  objectTypes: ProfileObjectTarget[]
  samples: string[]
}

export interface ProfileClass {
  iri: string
  label: string | null
  instanceCount: number
  properties: ProfileProperty[]
}

export interface DatasetProfile {
  provider: TriplestoreProvider
  endpoint: string
  builtAt: string
  graphs: NamedGraph[]
  prefixes: Record<string, string>
  tripleCount: number | null
  classes: ProfileClass[]
  looseProperties: ProfileProperty[]
}

interface ClassRow {
  class: SparqlBindingValue
  count: SparqlBindingValue
}

interface PropertyRow {
  property: SparqlBindingValue
  count: SparqlBindingValue
}

interface SampleRow {
  property: SparqlBindingValue
  object: SparqlBindingValue
  objectType?: SparqlBindingValue
}

async function selectBindings(
  query: string
): Promise<Record<string, SparqlBindingValue>[]> {
  const runtime = await getWorkbenchRuntime()
  const result = await runtime.sparql.execute(query)
  if (result.kind !== 'bindings') return []
  return result.bindings
}

function numericValue(value: SparqlBindingValue | undefined): number {
  if (!value) return 0
  const parsed = Number(value.value)
  return Number.isFinite(parsed) ? parsed : 0
}

function iriValue(value: SparqlBindingValue | undefined): string | null {
  if (!value || value.type === 'bnode' || value.type === 'literal') return null
  return value.value
}

function termToSample(value: SparqlBindingValue, maxChars: number): string {
  if (value.type === 'bnode') return '_(blank node)'
  if (value.type === 'uri') return `<${value.value}>`
  const datatype = 'datatype' in value && value.datatype ? value.datatype : null
  const lang =
    'xml:lang' in value && value['xml:lang'] ? `@${value['xml:lang']}` : ''
  const text =
    value.value.length > maxChars
      ? `${value.value.slice(0, maxChars)}…`
      : value.value
  const suffix =
    datatype && datatype !== 'http://www.w3.org/2001/XMLSchema#string'
      ? `^^${datatype}`
      : lang
  return `"${text}"${suffix}`
}

async function listClassesWithCounts(
  maxClasses: number
): Promise<Map<string, number>> {
  const rows = (await selectBindings(`
    SELECT ?class (COUNT(DISTINCT ?subject) AS ?count)
    WHERE { ?subject a ?class }
    GROUP BY ?class
    ORDER BY DESC(?count)
    LIMIT ${maxClasses}
  `)) as unknown as ClassRow[]
  const counts = new Map<string, number>()
  for (const row of rows) {
    const classIri = iriValue(row.class)
    if (!classIri) continue
    counts.set(classIri, numericValue(row.count))
  }
  return counts
}

async function listClassLabels(
  classIris: string[]
): Promise<Map<string, string>> {
  if (classIris.length === 0) return new Map()
  const values = classIris.map((iri) => `<${requireSafeIri(iri)}>`).join(' ')
  const rows = await selectBindings(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?entity ?label
    WHERE {
      VALUES ?entity { ${values} }
      ?entity rdfs:label ?label .
    }
  `)
  const labels = new Map<string, string>()
  const preferred = new Set<string>()
  for (const row of rows) {
    const entity = iriValue(row.entity)
    const label = row.label
    if (!entity || !label || label.type !== 'literal') continue
    const lang = 'xml:lang' in label ? label['xml:lang'] : undefined
    const isPreferred = !lang || lang === 'en'
    if (!labels.has(entity) || (isPreferred && !preferred.has(entity))) {
      labels.set(entity, label.value)
      if (isPreferred) preferred.add(entity)
    }
  }
  return labels
}

async function listClassProperties(
  classIri: string,
  maxProperties: number
): Promise<Map<string, number>> {
  const rows = (await selectBindings(`
    SELECT ?property (COUNT(*) AS ?count)
    WHERE { ?subject a <${requireSafeIri(classIri)}> ; ?property ?object . }
    GROUP BY ?property
    ORDER BY DESC(?count)
    LIMIT ${maxProperties}
  `)) as unknown as PropertyRow[]
  const counts = new Map<string, number>()
  for (const row of rows) {
    const propertyIri = iriValue(row.property)
    if (!propertyIri) continue
    counts.set(propertyIri, numericValue(row.count))
  }
  return counts
}

interface SampledProperty {
  samples: string[]
  objectTypes: Map<string, ProfileObjectTarget>
}

async function sampleClassObjects(
  classIri: string,
  scanLimit: number
): Promise<Map<string, SampledProperty>> {
  const rows = (await selectBindings(`
    SELECT ?property ?object ?objectType
    WHERE {
      ?subject a <${requireSafeIri(classIri)}> ;
        ?property ?object .
      OPTIONAL { ?object a ?objectType . }
    }
    LIMIT ${scanLimit}
  `)) as unknown as SampleRow[]

  const perProperty = new Map<string, SampledProperty>()
  for (const row of rows) {
    const propertyIri = iriValue(row.property)
    if (!propertyIri || row.object.type === 'bnode') continue
    let entry = perProperty.get(propertyIri)
    if (!entry) {
      entry = { samples: [], objectTypes: new Map() }
      perProperty.set(propertyIri, entry)
    }
    if (entry.samples.length < 12) {
      const sample = termToSample(row.object, 80)
      if (!entry.samples.includes(sample)) entry.samples.push(sample)
    }
    if (row.object.type === 'uri') {
      const objectType = row.objectType
      if (objectType && objectType.type === 'uri') {
        const target = entry.objectTypes.get(objectType.value)
        if (target) target.count += 1
        else
          entry.objectTypes.set(objectType.value, {
            kind: 'class',
            iri: objectType.value,
            count: 1
          })
      }
    } else if (row.object.type === 'literal') {
      const datatype =
        'datatype' in row.object ? row.object.datatype : undefined
      const key = datatype ?? 'http://www.w3.org/2001/XMLSchema#string'
      const target = entry.objectTypes.get(key)
      if (target) target.count += 1
      else entry.objectTypes.set(key, { kind: 'datatype', iri: key, count: 1 })
    }
  }
  return perProperty
}

async function listGlobalProperties(
  maxProperties: number
): Promise<Map<string, number>> {
  const rows = (await selectBindings(`
    SELECT ?property (COUNT(*) AS ?count)
    WHERE { ?subject ?property ?object . }
    GROUP BY ?property
    ORDER BY DESC(?count)
    LIMIT ${maxProperties}
  `)) as unknown as PropertyRow[]
  const counts = new Map<string, number>()
  for (const row of rows) {
    const propertyIri = iriValue(row.property)
    if (!propertyIri) continue
    counts.set(propertyIri, numericValue(row.count))
  }
  return counts
}

async function readTotalTriples(): Promise<number | null> {
  const runtime = await getWorkbenchRuntime()
  try {
    const overview = await runtime.getEndpointOverview()
    return overview.totalTriples
  } catch {
    return null
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        results[index] = await worker(items[index])
      }
    }
  )
  await Promise.all(runners)
  return results
}

function toProfileProperties(
  counts: Map<string, number>,
  sampled: Map<
    string,
    { samples: string[]; objectTypes: Map<string, ProfileObjectTarget> }
  >,
  maxSamples: number
): ProfileProperty[] {
  const properties: ProfileProperty[] = []
  for (const [iri, count] of counts) {
    const entry = sampled.get(iri)
    const objectTypes = entry
      ? [...entry.objectTypes.values()]
          .filter((target) => target.kind !== 'bnode')
          .sort((a, b) => b.count - a.count)
          .slice(0, 4)
      : []
    properties.push({
      iri,
      count,
      objectTypes,
      samples: entry ? entry.samples.slice(0, maxSamples) : []
    })
  }
  return properties.sort((a, b) => b.count - a.count)
}

export async function buildDatasetProfile(): Promise<DatasetProfile> {
  const runtime = await getWorkbenchRuntime()
  const runtimeConfig = getRuntimeConfig()
  const aiConfig: AiConfig | null = getAiConfig()
  const maxClasses = aiConfig?.AI_PROFILE_MAX_CLASSES ?? 60
  const maxPropertiesPerClass = aiConfig?.AI_PROFILE_MAX_PROPERTIES ?? 30
  const maxSamples = aiConfig?.AI_PROFILE_MAX_SAMPLES ?? 3
  const sampleScanLimit = 150

  const [graphs, prefixes, tripleCount, classCounts, globalProperties] =
    await Promise.all([
      runtime.graphs.listNamedGraphs().catch(() => [] as NamedGraph[]),
      runtime.prefixes.list().catch(() => ({}) as Record<string, string>),
      readTotalTriples(),
      listClassesWithCounts(maxClasses),
      listGlobalProperties(200).catch(() => new Map<string, number>())
    ])

  const classIris = [...classCounts.keys()]
  const labels = await listClassLabels(classIris)

  const perClassResults = await mapWithConcurrency(
    classIris,
    4,
    async (classIri) => {
      const [propertyCounts, sampled] = await Promise.all([
        listClassProperties(classIri, maxPropertiesPerClass).catch(
          () => new Map<string, number>()
        ),
        sampleClassObjects(classIri, sampleScanLimit).catch(
          () => new Map<string, SampledProperty>()
        )
      ])
      return { classIri, propertyCounts, sampled }
    }
  )

  const coveredProperties = new Set<string>()
  const classes: ProfileClass[] = perClassResults.map(
    ({ classIri, propertyCounts, sampled }) => {
      const properties = toProfileProperties(
        propertyCounts,
        sampled,
        maxSamples
      )
      for (const property of properties) coveredProperties.add(property.iri)
      return {
        iri: classIri,
        label: labels.get(classIri) ?? null,
        instanceCount: classCounts.get(classIri) ?? 0,
        properties
      }
    }
  )

  const looseProperties: ProfileProperty[] = []
  for (const [iri, count] of globalProperties) {
    if (coveredProperties.has(iri)) continue
    looseProperties.push({ iri, count, objectTypes: [], samples: [] })
  }

  return {
    provider: runtime.provider,
    endpoint: runtimeConfig.SPARQL_ENDPOINT,
    builtAt: new Date().toISOString(),
    graphs,
    prefixes,
    tripleCount,
    classes,
    looseProperties: looseProperties.slice(0, 25)
  }
}
