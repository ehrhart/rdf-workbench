import { type NextRequest, NextResponse } from 'next/server'
import { anonymousReadEnabled, resolveAccess } from '@/config/access'
import type { FeatureId, TriplestoreProvider } from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import {
  acceptsHtml,
  isSparqlQueryBody,
  isSparqlResultAccept,
  isSparqlResultFormat
} from '@/lib/sparql/negotiation'

type SparqlRouting = 'page' | 'query' | 'not-acceptable'

/**
 * What session validation reports to the proxy about the caller. The role
 * is null when the validation module does not return one (the Virtuoso
 * session payload has no role); `admin` enforcement then stays with the
 * page and action layers, as it does today.
 */
interface ProxyPrincipal {
  role: 'admin' | 'user' | null
}

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
    anonymousReadEnabled: anonymousReadEnabled()
  })

  if (decision.featureMissing) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (decision.access === 'public' || decision.access === 'anonymousRead') {
    return NextResponse.next()
  }

  const principal = await validateProxySession(provider, request)
  if (!principal) {
    return unauthenticatedResponse(request, pathname)
  }
  if (decision.access === 'admin' && principal.role === 'user') {
    return adminDeniedResponse(pathname)
  }

  return NextResponse.next()
}

/**
 * Session validation for the proxy. Virtuoso keeps its adapter-backed
 * module (it reads the cookie itself); the local providers (qlever,
 * oxigraph) store sha256-hashed tokens in the workbench SQLite database,
 * so the cookie token is validated with a hashed lookup, an expiry check
 * and an enabled-user check instead of the old presence-only cookie
 * test. The proxy runs on the Node.js runtime, where better-sqlite3 is
 * available. Any failure — including a missing or misconfigured database
 * — counts as unauthenticated.
 */
async function validateProxySession(
  provider: TriplestoreProvider | null,
  request: NextRequest
): Promise<ProxyPrincipal | null> {
  try {
    if (provider === 'virtuoso') {
      const session = await (
        await import('./providers/virtuoso/session-validation')
      ).validateSession()
      return session ? { role: null } : null
    }

    const token = request.cookies.get('session')?.value
    if (!token) return null

    const { getLocalPrincipalByToken } = await import('./lib/local-auth')
    const principal = await getLocalPrincipalByToken(token)
    return principal ? { role: principal.role } : null
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
