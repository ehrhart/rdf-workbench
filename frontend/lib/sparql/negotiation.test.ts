import { describe, expect, it } from 'vitest'
import {
  acceptsHtml,
  getRequestedFormat,
  isSparqlResultFormat
} from './negotiation'

function params(value: string): URLSearchParams {
  return new URLSearchParams({ format: value })
}

describe('getRequestedFormat', () => {
  it('resolves short names to media types, case-insensitively', () => {
    expect(getRequestedFormat(params('json'))).toBe(
      'application/sparql-results+json'
    )
    expect(getRequestedFormat(params('JSON'))).toBe(
      'application/sparql-results+json'
    )
    expect(getRequestedFormat(params('ttl'))).toBe('text/turtle')
    expect(getRequestedFormat(params('html'))).toBe('text/html')
    expect(getRequestedFormat(params('rdf'))).toBe('application/rdf+xml')
    expect(getRequestedFormat(params('jsonld'))).toBe('application/ld+json')
  })

  it('passes full media types through untouched', () => {
    expect(getRequestedFormat(params('application/sparql-results+json'))).toBe(
      'application/sparql-results+json'
    )
    expect(getRequestedFormat(params('text/turtle'))).toBe('text/turtle')
  })

  it('keeps unknown values for the caller to reject', () => {
    expect(getRequestedFormat(params('bogus'))).toBe('bogus')
  })

  it('reads output= as an alias of format=', () => {
    const search = new URLSearchParams({ output: 'csv' })
    expect(getRequestedFormat(search)).toBe('text/csv')
  })

  it('returns null for absent or blank values', () => {
    expect(getRequestedFormat(new URLSearchParams())).toBeNull()
    expect(getRequestedFormat(params(' '))).toBeNull()
  })

  it('resolves every alias to a known result or graph media type', () => {
    for (const alias of [
      'json',
      'xml',
      'csv',
      'tsv',
      'ttl',
      'nt',
      'nq',
      'jsonld',
      'rdf'
    ]) {
      expect(isSparqlResultFormat(getRequestedFormat(params(alias)))).toBe(true)
    }
  })
})

describe('acceptsHtml', () => {
  it('treats missing Accept and */* as browser requests', () => {
    expect(acceptsHtml(null)).toBe(true)
    expect(acceptsHtml('*/*')).toBe(true)
    expect(acceptsHtml('text/html,application/xhtml+xml')).toBe(true)
  })

  it('treats SPARQL media types as non-browser requests', () => {
    expect(acceptsHtml('application/sparql-results+json')).toBe(false)
    expect(acceptsHtml('text/turtle')).toBe(false)
  })
})
