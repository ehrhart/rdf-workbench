import { type NextRequest, NextResponse } from 'next/server'
import { unauthenticatedResponse } from '@/lib/api-auth'
import { PUBLIC_QUERY_OWNER } from '@/lib/query-registry'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type {
  Principal,
  SparqlQueryKind,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { detectQueryKind } from '@/lib/sparql/kind'
import { GRAPH_FORMATS, getRequestedFormat } from '@/lib/sparql/negotiation'

/**
 * The SPARQL protocol handler behind `/sparql`. The proxy rewrites
 * query-shaped requests here. Direct requests to `/internal/` are answered
 * 404 by the edge, so this file has no public URL.
 */

const GRAPH_MEDIA_TYPES: readonly string[] = GRAPH_FORMATS.map(
  (format) => format.mime
)

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return jsonError('Query is required.', 400)
  }
  const format = getRequestedFormat(request.nextUrl.searchParams)
  return runQuery(request, query, format ?? request.headers.get('accept'))
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text())
    const update = form.get('update')
    if (update) return runUpdate(request, update)
    const query = form.get('query')
    if (!query) return jsonError('Query is required.', 400)
    return runQuery(request, query, request.headers.get('accept'))
  }

  if (contentType.includes('application/sparql-update')) {
    const update = (await request.text()).trim()
    if (!update) return jsonError('Query is required.', 400)
    return runUpdate(request, update)
  }

  const query = await readQueryBody(request)
  if (!query) return jsonError('Query is required.', 400)
  return runQuery(request, query, request.headers.get('accept'))
}

async function runQuery(
  request: NextRequest,
  query: string,
  accept: string | null
) {
  const runtime = await getWorkbenchRuntime()
  const principal = await safePrincipal(runtime)
  const requested = accept?.trim() || 'application/sparql-results+json'
  return streamDownload(
    runtime,
    request.signal,
    query,
    negotiateAccept(detectQueryKind(query), requested),
    principal?.id ?? PUBLIC_QUERY_OWNER
  )
}

/**
 * CONSTRUCT and DESCRIBE cannot be serialized as SPARQL result JSON, so a
 * kind-blind Accept would make strict engines reject what the console
 * legitimately sends. Negotiate to Turtle unless the client asked for a
 * graph format itself.
 */
function negotiateAccept(kind: SparqlQueryKind, requested: string): string {
  const isGraphKind = kind === 'construct' || kind === 'describe'
  if (!isGraphKind) return requested
  const isGraphAccept = GRAPH_MEDIA_TYPES.some((mime) =>
    requested.toLowerCase().includes(mime)
  )
  return isGraphAccept ? requested : 'text/turtle'
}

async function runUpdate(request: NextRequest, update: string) {
  if (!isSameOriginMutation(request)) return sameOriginError()

  const runtime = await getWorkbenchRuntime()
  const principal = await safePrincipal(runtime)
  if (!principal || principal.mustChangePassword) {
    return unauthenticatedResponse()
  }

  try {
    await runtime.sparql.execute(update, {
      kind: 'update',
      ownerId: principal.id,
      origin: 'sparql',
      signal: request.signal
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function streamDownload(
  runtime: WorkbenchRuntime,
  clientSignal: AbortSignal,
  query: string,
  accept: string,
  ownerId: string
) {
  try {
    const upstream = await runtime.sparql.download(query, accept, {
      ownerId,
      origin: 'sparql',
      signal: clientSignal
    })
    const contentType = upstream.headers.get('content-type') ?? accept

    if (!upstream.ok) {
      const body = await upstream.text()
      return new Response(body || "Couldn't run the query.", {
        status: upstream.status,
        headers: { 'Content-Type': contentType }
      })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function errorResponse(error: unknown): NextResponse {
  const isTimeout = error instanceof SparqlTimeoutError
  const isAbort =
    !isTimeout && error instanceof DOMException && error.name === 'AbortError'
  if (isAbort) return jsonError('Query aborted', 499)
  if (isTimeout) return jsonError(error.message, 504, 'timeout')
  const message =
    error instanceof Error ? error.message : "Couldn't run the query."
  return jsonError(message, 400)
}

async function safePrincipal(
  runtime: WorkbenchRuntime
): Promise<Principal | null> {
  try {
    const principal = await runtime.auth.getPrincipal()
    return principal && !principal.mustChangePassword ? principal : null
  } catch {
    return null
  }
}

async function readQueryBody(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await request.json().catch(() => null)) as {
      query?: string
    } | null
    return typeof payload?.query === 'string' ? payload.query : null
  }
  return (await request.text()) || null
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status }
  )
}
