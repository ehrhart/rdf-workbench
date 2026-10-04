import { type NextRequest, NextResponse } from 'next/server'
import {
  anonymousAskEnabled,
  anonymousReadEnabled,
  resolveAccess
} from '@/config/access'
import type {
  FeatureId,
  Principal,
  TriplestoreProvider
} from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import {
  acceptsHtml,
  isSparqlQueryBody,
  isSparqlResultAccept,
  isSparqlResultFormat
} from '@/lib/sparql/negotiation'

type SparqlRouting = 'page' | 'query' | 'not-acceptable'

function providerFromEnv(): TriplestoreProvider | null {
  const value = process.env.TRIPLESTORE_PROVIDER
  return value === 'virtuoso' || value === 'qlever' || value === 'oxigraph'
    ? value
    : null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const provider = providerFromEnv()

  const routing = classifySparqlRequest(request)
  if (routing === 'query') {
    return NextResponse.rewrite(new URL('/api/sparql/query', request.url))
  }
  if (routing === 'not-acceptable') {
    return new NextResponse('Not Acceptable', { status: 406 })
  }

  const decision = resolveAccess(pathname, {
    features: provider
      ? computeFeatures(provider, process.env)
      : new Set<FeatureId>(),
    anonymousReadEnabled: anonymousReadEnabled(),
    anonymousAskEnabled: anonymousAskEnabled()
  })

  if (decision.featureMissing) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (
    decision.access === 'public' ||
    decision.access === 'anonymousRead' ||
    decision.access === 'anonymousAsk'
  ) {
    return NextResponse.next()
  }

  const principal = await validateProxySession(request)
  if (!principal) {
    return unauthenticatedResponse(request, pathname)
  }
  if (decision.access === 'admin' && principal.role === 'user') {
    return adminDeniedResponse(pathname)
  }

  return NextResponse.next()
}

async function validateProxySession(
  request: NextRequest
): Promise<Principal | null> {
  try {
    const token = request.cookies.get('session')?.value
    if (!token) return null

    const { getLocalPrincipalByToken } = await import('./lib/local-auth')
    return await getLocalPrincipalByToken(token)
  } catch (error) {
    console.error('Proxy session validation failed:', error)
    return null
  }
}

async function unauthenticatedResponse(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  if (pathname.startsWith('/api/')) {
    const { unauthenticatedResponse: json } = await import('./lib/api-auth')
    return json()
  }

  const logoutUrl = new URL('/logout', request.url)
  logoutUrl.searchParams.set('redirect', pathname)
  const response = NextResponse.redirect(logoutUrl)

  response.cookies.delete('session')
  return response
}

function adminDeniedResponse(pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Administrator access required' },
      { status: 403 }
    )
  }
  // Same behavior as requirePageAccess: non-admins on admin pages get a 404.
  return new NextResponse('Not Found', { status: 404 })
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
