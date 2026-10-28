import type { NextRequest } from 'next/server'
import {
  acceptsHtml,
  getRequestedFormat,
  isHtmlFormat,
  isSparqlBody,
  isSparqlResultFormat
} from '@/lib/sparql/negotiation'

export type EdgeRouting =
  | 'pass'
  | 'sparqlPage'
  | 'sparqlData'
  | 'notAcceptable'
  | 'blocked'

export const CORS_PATHS: ReadonlySet<string> = new Set(['/sparql'])

const INTERNAL_PREFIX = '/internal/'

export function isInternalPath(pathname: string): boolean {
  return pathname.startsWith(INTERNAL_PREFIX)
}

export function classify(request: NextRequest): EdgeRouting {
  const { pathname } = request.nextUrl
  if (isInternalPath(pathname)) return 'blocked'
  if (pathname !== '/sparql') return 'pass'

  if (isNextJsInternalRequest(request)) return 'sparqlPage'

  const format = getRequestedFormat(request.nextUrl.searchParams)
  if (format) {
    if (isHtmlFormat(format)) return 'sparqlPage'
    return isSparqlResultFormat(format) ? 'sparqlData' : 'notAcceptable'
  }

  if (isBrowserRequest(request)) return 'sparqlPage'

  // A query payload is a protocol request regardless of the Accept header.
  if (request.nextUrl.searchParams.get('query')) return 'sparqlData'
  if (request.method === 'POST') {
    return isSparqlBody(request.headers.get('content-type'))
      ? 'sparqlData'
      : 'sparqlPage'
  }

  return acceptsHtml(request.headers.get('accept'))
    ? 'sparqlPage'
    : 'notAcceptable'
}

function isBrowserRequest(request: NextRequest): boolean {
  return (
    request.headers.get('accept')?.toLowerCase().includes('text/html') ?? false
  )
}

function isNextJsInternalRequest(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? ''
  return (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-state-tree') ||
    accept.includes('text/x-component')
  )
}
