import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { isSparqlBody } from '@/lib/sparql/negotiation'
import { classify, isInternalPath } from './policy'

function request(
  url: string,
  init: {
    method?: string
    accept?: string
    contentType?: string
    rsc?: boolean
  } = {}
): NextRequest {
  const headers = new Headers()
  if (init.accept) headers.set('accept', init.accept)
  if (init.contentType) headers.set('content-type', init.contentType)
  if (init.rsc) headers.set('rsc', '1')
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? 'GET',
    headers
  }) as NextRequest
}

describe('classify', () => {
  it('serves the console page for browser requests', () => {
    expect(classify(request('/sparql'))).toBe('sparqlPage')
    expect(
      classify(
        request('/sparql', { accept: 'text/html,application/xhtml+xml' })
      )
    ).toBe('sparqlPage')
  })

  it('keeps RSC navigations on the page', () => {
    expect(classify(request('/sparql', { rsc: true }))).toBe('sparqlPage')
  })

  it('routes protocol reads to the internal handler', () => {
    expect(
      classify(
        request('/sparql?query=SELECT%201', {
          accept: 'application/sparql-results+json'
        })
      )
    ).toBe('sparqlData')
    expect(classify(request('/sparql?query=SELECT%201&format=json'))).toBe(
      'sparqlData'
    )
    expect(
      classify(request('/sparql?query=SELECT%201&format=text/turtle'))
    ).toBe('sparqlData')
    expect(
      classify(
        request('/sparql', {
          method: 'POST',
          contentType: 'application/sparql-query'
        })
      )
    ).toBe('sparqlData')
    expect(
      classify(
        request('/sparql', {
          method: 'POST',
          contentType: 'application/x-www-form-urlencoded'
        })
      )
    ).toBe('sparqlData')
  })

  it('routes a query payload as protocol regardless of generic Accepts', () => {
    expect(
      classify(
        request('/sparql?query=SELECT%201', { accept: 'application/json' })
      )
    ).toBe('sparqlData')
    expect(
      classify(request('/sparql?query=SELECT%201', { accept: '*/*' }))
    ).toBe('sparqlData')
    expect(classify(request('/sparql?query=SELECT%201'))).toBe('sparqlData')
    expect(
      classify(request('/sparql?query=SELECT%201', { accept: 'text/turtle' }))
    ).toBe('sparqlData')
  })

  it('keeps ?query= URLs on the page for browsers that prefill the console', () => {
    expect(
      classify(
        request('/sparql?query=SELECT%201', {
          accept: 'text/html,application/xhtml+xml'
        })
      )
    ).toBe('sparqlPage')
  })

  it('routes update posts to the internal handler', () => {
    expect(
      classify(
        request('/sparql', {
          method: 'POST',
          contentType: 'application/sparql-update'
        })
      )
    ).toBe('sparqlData')
  })

  it('answers 406 for unknown formats and unknown non-browser accepts', () => {
    expect(classify(request('/sparql?query=SELECT%201&format=bogus'))).toBe(
      'notAcceptable'
    )
    expect(classify(request('/sparql', { accept: 'application/xml' }))).toBe(
      'notAcceptable'
    )
  })

  it('keeps console page semantics for non-sparql content types', () => {
    expect(
      classify(
        request('/sparql', {
          method: 'POST',
          contentType: 'text/plain'
        })
      )
    ).toBe('sparqlPage')
  })

  it('leaves every other path to normal routing', () => {
    expect(classify(request('/overview'))).toBe('pass')
    expect(classify(request('/api/console/download', { method: 'POST' }))).toBe(
      'pass'
    )
  })

  it('blocks direct hits on internal paths', () => {
    expect(classify(request('/internal/sparql'))).toBe('blocked')
    expect(classify(request('/internal/sparql', { method: 'POST' }))).toBe(
      'blocked'
    )
    expect(isInternalPath('/internal/sparql')).toBe(true)
    expect(isInternalPath('/internalized')).toBe(false)
    expect(isInternalPath('/api/console/download')).toBe(false)
  })
})

describe('isSparqlBody', () => {
  it('accepts both query and update media types plus forms and JSON', () => {
    expect(isSparqlBody('application/sparql-query')).toBe(true)
    expect(isSparqlBody('application/sparql-update')).toBe(true)
    expect(isSparqlBody('application/x-www-form-urlencoded')).toBe(true)
    expect(isSparqlBody('application/json')).toBe(true)
    expect(isSparqlBody('text/plain')).toBe(false)
    expect(isSparqlBody(null)).toBe(false)
  })
})
