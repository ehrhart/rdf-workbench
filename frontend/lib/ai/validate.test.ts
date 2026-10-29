import { describe, expect, it } from 'vitest'
import type { WorkbenchRuntime } from '@/lib/runtime/contracts'
import type { SparqlQueryResult } from '@/types'
import type { DatasetProfile } from './dataset-profile'
import { validateSparqlQuery } from './validate'
import { searchVocabulary } from './vocabulary'

const CITY = 'http://example.org/ontology/City'
const POPULATION = 'http://example.org/ontology/population'
const DATATYPE = 'http://www.w3.org/2001/XMLSchema#integer'

const PROFILE: DatasetProfile = {
  provider: 'generic',
  endpoint: 'https://example.org/sparql',
  builtAt: '2026-01-01T00:00:00.000Z',
  graphs: [],
  prefixes: {},
  tripleCount: null,
  classes: [
    {
      iri: CITY,
      label: 'City',
      instanceCount: 42,
      properties: [
        {
          iri: POPULATION,
          count: 42,
          objectTypes: [{ kind: 'datatype', iri: DATATYPE, count: 42 }],
          samples: ['100000']
        }
      ]
    }
  ],
  looseProperties: []
}

const options = { resultLimit: 1000, checkVocabulary: true }

describe('validateSparqlQuery vocabulary checks', () => {
  it('passes a query whose class and predicate come from the profile', () => {
    const query = `SELECT ?city WHERE { ?city a <${CITY}> ; <${POPULATION}> ?pop . }`
    const result = validateSparqlQuery(query, PROFILE, options)
    expect(result.ok).toBe(true)
  })

  it('rejects a class the profile does not list', () => {
    const query =
      'SELECT ?s WHERE { ?s a <http://example.org/ontology/Spaceship> . }'
    const result = validateSparqlQuery(query, PROFILE, options)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some((issue) =>
        issue.includes('<http://example.org/ontology/Spaceship>')
      )
    ).toBe(true)
  })

  it('does not whitelist profile datatype IRIs as predicates', () => {
    const query = `SELECT ?s WHERE { ?s <${DATATYPE}> ?o . }`
    const result = validateSparqlQuery(query, PROFILE, options)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.includes(`<${DATATYPE}>`))).toBe(
      true
    )
  })
})

const SPACESHIP = 'http://example.org/ontology/Spaceship'
const SHIP_CREW = 'http://example.org/ontology/shipCrew'
const SCANNER = 'http://example.org/ontology/Scanner'
const SCAN_RANGE = 'http://example.org/ontology/scanRange'
const SERIAL_NUMBER = 'http://example.org/ontology/serialNumber'
const STARSHIP = 'http://example.org/ontology/Starship'
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class'

const VOCAB_PROFILE: DatasetProfile = {
  provider: 'generic',
  endpoint: 'https://example.org/sparql',
  builtAt: '2026-01-01T00:00:00.000Z',
  graphs: [],
  prefixes: {},
  tripleCount: null,
  classes: [
    {
      iri: SCANNER,
      label: 'Scanner device',
      instanceCount: 4,
      properties: [{ iri: SCAN_RANGE, count: 4, objectTypes: [], samples: [] }]
    },
    {
      iri: SPACESHIP,
      label: 'Spaceship',
      instanceCount: 3,
      properties: [{ iri: SHIP_CREW, count: 3, objectTypes: [], samples: [] }]
    }
  ],
  looseProperties: [
    { iri: SERIAL_NUMBER, count: 5, objectTypes: [], samples: [] }
  ]
}

function emptyBindings(): SparqlQueryResult {
  return { kind: 'bindings', variables: [], bindings: [] }
}

function vocabRuntime(probe: unknown): WorkbenchRuntime {
  return {
    provider: 'generic',
    sparql: {
      execute: async () => {
        if (probe instanceof Error) throw probe
        return probe as SparqlQueryResult
      }
    }
  } as unknown as WorkbenchRuntime
}

function probeResult(value: string): SparqlQueryResult {
  return {
    kind: 'bindings',
    variables: ['entity', 'entityType', 'label'],
    bindings: [
      {
        entity: { type: 'uri', value },
        entityType: { type: 'uri', value: OWL_CLASS },
        label: { type: 'literal', value: 'Starship' }
      }
    ]
  } as SparqlQueryResult
}

describe('searchVocabulary', () => {
  it('matches a profile class by local name and keeps its profile label', async () => {
    const result = await searchVocabulary(
      vocabRuntime(emptyBindings()),
      VOCAB_PROFILE,
      'Spaceship'
    )
    expect(result.hits).toEqual([
      { iri: SPACESHIP, kind: 'class', label: 'Spaceship' }
    ])
  })

  it('keeps only the requested kind', async () => {
    const result = await searchVocabulary(
      vocabRuntime(emptyBindings()),
      VOCAB_PROFILE,
      'scan',
      { kind: 'class' }
    )
    expect(result.hits).toEqual([
      { iri: SCANNER, kind: 'class', label: 'Scanner device' }
    ])
  })

  it('merges endpoint schema hits with their label, skipping profile IRIs', async () => {
    const result = await searchVocabulary(
      vocabRuntime(probeResult(STARSHIP)),
      VOCAB_PROFILE,
      'ship'
    )
    expect(result.hits.map((hit) => hit.iri)).toEqual([
      SPACESHIP,
      SHIP_CREW,
      STARSHIP
    ])
    expect(result.hits[2]).toEqual({
      iri: STARSHIP,
      kind: 'class',
      label: 'Starship'
    })
  })

  it('keeps profile hits without a note when the endpoint probe fails', async () => {
    const result = await searchVocabulary(
      vocabRuntime(new Error('probe down')),
      VOCAB_PROFILE,
      'ship'
    )
    expect(result.hits.map((hit) => hit.iri)).toEqual([SPACESHIP, SHIP_CREW])
    expect(result.note).toBeUndefined()
  })

  it('explains the failure when the probe fails and nothing matches locally', async () => {
    const result = await searchVocabulary(
      vocabRuntime(new Error('probe down')),
      VOCAB_PROFILE,
      'warp'
    )
    expect(result.hits).toEqual([])
    expect(result.note).toBe('Endpoint vocabulary search failed.')
  })

  it('rejects a one-character term with a note', async () => {
    const result = await searchVocabulary(
      vocabRuntime(emptyBindings()),
      VOCAB_PROFILE,
      's'
    )
    expect(result.hits).toEqual([])
    expect(result.note).toContain('two characters')
  })

  it('rejects terms with quotes or backslashes with a note', async () => {
    const result = await searchVocabulary(
      vocabRuntime(emptyBindings()),
      VOCAB_PROFILE,
      'ship"'
    )
    expect(result.hits).toEqual([])
    expect(result.note).toContain('quotes')
  })

  it('returns a note when nothing matches anywhere', async () => {
    const result = await searchVocabulary(
      vocabRuntime(emptyBindings()),
      VOCAB_PROFILE,
      'zzz'
    )
    expect(result.hits).toEqual([])
    expect(result.note).toBe('No classes or predicates matched "zzz".')
  })
})
