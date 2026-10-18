import { type NextRequest, NextResponse } from 'next/server'
import {
  PUBLIC_QUERY_OWNER,
  registerQuery,
  unregisterQuery
} from '@/lib/query-registry'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { WorkbenchRuntime } from '@/lib/runtime/contracts'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return jsonError('No query provided', 400)
  }
  const format = request.nextUrl.searchParams.get('format')
  const accept = format ?? request.headers.get('accept')
  return runPublicQuery(request, query, accept)
}

export async function POST(request: NextRequest) {
  const query = await readQueryBody(request)
  if (!query) {
    return jsonError('No query provided', 400)
  }
  return runPublicQuery(request, query, request.headers.get('accept'))
}

async function runPublicQuery(
  request: NextRequest,
  query: string,
  accept: string | null
) {
  const runtime = await getWorkbenchRuntime()
  const requested = accept?.trim() || 'application/sparql-results+json'
  return streamDownload(runtime, request.signal, query, requested)
}

async function streamDownload(
  runtime: WorkbenchRuntime,
  clientSignal: AbortSignal,
  query: string,
  accept: string
) {
  const queryId = crypto.randomUUID()
  const controller = new AbortController()
  registerQuery(queryId, PUBLIC_QUERY_OWNER, query, () => controller.abort())
  try {
    const upstream = await runtime.sparql.download(query, accept, {
      queryId,
      signal: AbortSignal.any([clientSignal, controller.signal])
    })
    const contentType = upstream.headers.get('content-type') ?? accept

    if (!upstream.ok) {
      const body = await upstream.text()
      return new Response(body || 'SPARQL query failed', {
        status: upstream.status,
        headers: { 'Content-Type': contentType }
      })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType }
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'SPARQL query failed'
    return jsonError(message, 400)
  } finally {
    unregisterQuery(queryId)
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
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text())
    return params.get('query')
  }
  return (await request.text()) || null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
