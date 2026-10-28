import { type NextRequest, NextResponse } from 'next/server'
import { unauthenticatedResponse } from '@/lib/api-auth'
import { PUBLIC_QUERY_OWNER } from '@/lib/query-registry'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { Principal, WorkbenchRuntime } from '@/lib/runtime/contracts'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { getRequestedFormat } from '@/lib/sparql/negotiation'

/**
 * The SPARQL protocol handler behind `/sparql`. The proxy rewrites
 * query-shaped requests here. Direct requests to `/internal/` are answered
 * 404 by the edge, so this file has no public URL.
 */

const DATASET_PARAM_NAMES = [
  'default-graph-uri',
  'named-graph-uri',
  'using-graph-uri',
  'using-named-graph-uri'
]

function collectForwardParams(
  request: NextRequest,
  form?: URLSearchParams
): URLSearchParams | undefined {
  const forwarded = new URLSearchParams()
  for (const source of [request.nextUrl.searchParams, form]) {
    if (!source) continue
    for (const name of DATASET_PARAM_NAMES) {
      for (const value of source.getAll(name)) {
        if (value.trim() !== '') forwarded.append(name, value)
      }
    }
  }
  return forwarded.size > 0 ? forwarded : undefined
}

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
    if (update) return runUpdate(request, update, form)
    const query = form.get('query')
    if (!query) return jsonError('Query is required.', 400)
    return runQuery(request, query, request.headers.get('accept'), form)
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
  accept: string | null,
  form?: URLSearchParams
) {
  const runtime = await getWorkbenchRuntime()
  const principal = await safePrincipal(runtime)
  return streamDownload(
    runtime,
    request.signal,
    query,
    accept?.trim() || '*/*',
    principal?.id ?? PUBLIC_QUERY_OWNER,
    collectForwardParams(request, form)
  )
}

async function runUpdate(
  request: NextRequest,
  update: string,
  form?: URLSearchParams
) {
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
      signal: request.signal,
      forwardParams: collectForwardParams(request, form)
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
  ownerId: string,
  forwardParams?: URLSearchParams
) {
  try {
    const upstream = await runtime.sparql.download(query, accept, {
      ownerId,
      origin: 'sparql',
      signal: clientSignal,
      forwardParams
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
