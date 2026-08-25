import { type NextRequest, NextResponse } from 'next/server'
import {
  acceptsHtml,
  isSparqlQueryBody,
  isSparqlResultAccept
} from '@/lib/sparql/negotiation'

const PUBLIC_PATHS = ['/login', '/logout']

type SparqlRouting = 'page' | 'query' | 'not-acceptable'

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

  const unavailableForQlever =
    provider === 'qlever' &&
    (pathname.startsWith('/isql') ||
      pathname.startsWith('/import') ||
      pathname.startsWith('/fulltext-index') ||
      (pathname.startsWith('/monitor/queries') &&
        !process.env.QLEVER_ACCESS_TOKEN) ||
      pathname.startsWith('/api/isql') ||
      pathname.startsWith('/api/import') ||
      pathname === '/api/export')
  const unavailableForVirtuoso =
    provider === 'virtuoso' && pathname.startsWith('/admin/users')

  if (unavailableForQlever || unavailableForVirtuoso) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Only protect paths that are clearly protected (e.g., start with specific prefixes)
  // This allows for public pages to exist without forcing login
  const isDashboardRoute =
    provider === 'virtuoso'
      ? pathname.startsWith('/isql') ||
        pathname.startsWith('/import') ||
        pathname.startsWith('/namespaces') ||
        pathname.startsWith('/fulltext-index') ||
        pathname.startsWith('/monitor')
      : pathname.startsWith('/admin/users')

  if (!isDashboardRoute) {
    return NextResponse.next()
  }

  // Get and verify session
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
