import { describe, expect, it } from 'vitest'
import type { DatasetProfile } from './dataset-profile'
import { validateSparqlQuery } from './validate'

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
