import { type NextRequest, NextResponse } from 'next/server'
import {
  acceptsHtml,
  isSparqlQueryBody,
  isSparqlResultAccept,
  isSparqlResultFormat
} from '@/lib/sparql/negotiation'

const PUBLIC_PATHS = ['/login', '/logout', '/health']

type SparqlRouting = 'page' | 'query' | 'not-acceptable'

const blockedPathPrefixes: Partial<Record<string, readonly string[]>> = {
  qlever: [
    '/isql',
    '/import',
    '/fulltext-index',
    '/api/isql',
    '/api/import',
    '/api/export'
  ],
  virtuoso: ['/admin/users']
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const provider = process.env.TRIPLESTORE_PROVIDER

  const routing = classifySparqlRequest(request)
  if (routing === 'query') {
    return NextResponse.rewrite(new URL('/api/sparql/query', request.url))
  }
  if (routing === 'not-acceptable') {
    return new NextResponse('Not Acceptable', { status: 406 })
  }

  const blockedForProvider =
    blockedPathPrefixes[provider ?? '']?.some((prefix) =>
      pathname.startsWith(prefix)
    ) ??
    (provider === 'qlever' &&
      pathname.startsWith('/monitor/queries') &&
      !process.env.QLEVER_ACCESS_TOKEN)

  if (blockedForProvider) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // All other routes require a session
  const session =
    provider === 'virtuoso'
      ? await (
          await import('./providers/virtuoso/session-validation')
        ).validateSession()
      : request.cookies.get('session')?.value
  if (!session) {
    const logoutUrl = new URL('/logout', request.url)
    logoutUrl.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(logoutUrl)

    // Clear the invalid session cookie
    response.cookies.delete('session')
    return response
  }

  return NextResponse.next()
}

function classifySparqlRequest(request: NextRequest): SparqlRouting {
  if (request.nextUrl.pathname !== '/sparql') return 'page'

  if (isSparqlResultAccept(request.headers.get('accept'))) return 'query'

  if (request.method === 'POST') {
    return isSparqlQueryBody(request.headers.get('content-type'))
      ? 'query'
      : 'page'
  }

  if (isNextJsInternalRequest(request)) return 'page'

  const format = request.nextUrl.searchParams.get('format')
  if (format) {
    return isSparqlResultFormat(format) ? 'query' : 'not-acceptable'
  }

  return acceptsHtml(request.headers.get('accept')) ? 'page' : 'not-acceptable'
}

function isNextJsInternalRequest(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? ''
  return (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-state-tree') ||
    accept.includes('text/x-component')
  )
}

export default proxy

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
