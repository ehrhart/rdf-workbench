import { type NextRequest, NextResponse } from 'next/server'
import {
  isPasswordChangeAllowed,
  PASSWORD_CHANGE_PATH,
  resolveAccess
} from '@/config/access'
import { applyCorsHeaders, corsAllowOrigin, getCorsConfig } from '@/lib/cors'
import { CORS_PATHS, classify } from '@/lib/edge/policy'
import type {
  FeatureId,
  Principal,
  TriplestoreProvider
} from '@/lib/runtime/contracts'
import { isTriplestoreProvider } from '@/lib/runtime/contracts'
import { computeFeatures } from '@/lib/runtime/features'
import {
  GRAPH_FORMATS,
  getRequestedFormat,
  isHtmlFormat
} from '@/lib/sparql/negotiation'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cors = getCorsConfig()
  const corsOrigin =
    CORS_PATHS.has(pathname) && cors.enabled
      ? corsAllowOrigin(request.headers.get('origin'), cors)
      : null

  if (request.method === 'OPTIONS' && corsOrigin) {
    // Preflights carry no credentials and must bypass the session gates:
    // a flagged session would otherwise answer them with a password-change
    // redirect.
    const preflight = new NextResponse(null, { status: 204 })
    applyCorsHeaders(preflight, corsOrigin, cors)
    return preflight
  }

  const response = await routeProxy(request)
  if (corsOrigin) applyCorsHeaders(response, corsOrigin, cors)
  return response
}

function providerFromEnv(): TriplestoreProvider | null {
  const value = process.env.TRIPLESTORE_PROVIDER
  return isTriplestoreProvider(value) ? value : null
}

async function routeProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const provider = providerFromEnv()

  const routing = classify(request)
  if (routing === 'notAcceptable') {
    return new NextResponse('Not Acceptable', { status: 406 })
  }
  if (routing === 'blocked') {
    return new NextResponse('Not Found', { status: 404 })
  }

  // The session is resolved on EVERY cookie-bearing request — public
  // paths included. The must-change gate must run before both the SPARQL
  // rewrite and the public fast path: each would otherwise return before
  // any access check, letting a flagged session through.
  const principal = await validateProxySession(request)

  if (principal?.mustChangePassword && !isPasswordChangeAllowed(pathname)) {
    return passwordChangeRequiredResponse(request, pathname)
  }

  const { getAccessFlags } = await import('./lib/access/access-flags')
  const { allowAnonymousRead, allowAnonymousAsk, allowAnonymousSparql } =
    await getAccessFlags()

  const options = {
    features: provider
      ? computeFeatures(provider, process.env)
      : new Set<FeatureId>(),
    anonymousReadEnabled: allowAnonymousRead,
    anonymousAskEnabled: allowAnonymousAsk,
    anonymousSparqlEnabled: allowAnonymousSparql
  }

  const decision = resolveAccess(pathname, options)

  const allowed =
    decision.access === 'public' ||
    decision.access === 'anonymousRead' ||
    decision.access === 'anonymousAsk' ||
    decision.access === 'anonymousSparql'

  if (routing === 'sparqlData') {
    if (!allowAnonymousSparql && !principal) {
      const { unauthenticatedResponse } = await import('./lib/api-auth')
      return unauthenticatedResponse()
    }
    return NextResponse.rewrite(new URL('/internal/sparql', request.url))
  }

  if (decision.featureMissing) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (allowed || principal) {
    if (await shouldServeRdfDescription(request)) {
      return NextResponse.rewrite(
        new URL(
          `/api/dereference${request.nextUrl.pathname.replace(/\/+$/, '')}`,
          request.url
        )
      )
    }
  }

  if (allowed) {
    return NextResponse.next()
  }

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

async function passwordChangeRequiredResponse(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  if (pathname.startsWith('/api/')) {
    const { passwordChangeRequiredResponse: json } = await import(
      './lib/api-auth'
    )
    return json()
  }

  // The session cookie is kept — unlike unauthenticatedResponse — because
  // the session is valid. Deleting it would lock the user out of the
  // change surface itself.
  const changeUrl = new URL(PASSWORD_CHANGE_PATH, request.url)
  changeUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(changeUrl)
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

async function shouldServeRdfDescription(
  request: NextRequest
): Promise<boolean> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false

  const requestedFormat = getRequestedFormat(request.nextUrl.searchParams)
  if (isHtmlFormat(requestedFormat)) return false
  if (requestedFormat) return true

  const accept = request.headers.get('accept')?.toLowerCase()
  if (!accept || accept.includes('text/html')) return false
  if (!GRAPH_FORMATS.some((format) => accept.includes(format.mime))) {
    return false
  }

  // Only paths configured as dereferenceable negotiate. Every other page
  // keeps serving HTML regardless of Accept.
  const entity = request.nextUrl.pathname.split('/').filter(Boolean)[0]
  if (!entity) return false
  const { dereferenceRepository } = await import('@/lib/dereference/repository')
  const configured = await dereferenceRepository.list().catch(() => [])
  return configured.some((entry) => entry.path === entity)
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
