import { type NextRequest, NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type {
  SparqlRequestOptions,
  WorkbenchRuntime
} from '@/lib/runtime/contracts'
import {
  PUBLIC_QUERY_OWNER,
  registerQuery,
  unregisterQuery
} from '@/providers/qlever/query-registry'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return jsonError('No query provided', 400)
  }
  return runPublicQuery(query, request.headers.get('accept'))
}

export async function POST(request: NextRequest) {
  const query = await readQueryBody(request)
  if (!query) {
    return jsonError('No query provided', 400)
  }
  return runPublicQuery(query, request.headers.get('accept'))
}

async function runPublicQuery(query: string, accept: string | null) {
  const runtime = await getWorkbenchRuntime()
  const requested = accept?.trim() || 'application/sparql-results+json'
  return streamDownload(runtime, query, requested)
}

async function streamDownload(
  runtime: WorkbenchRuntime,
  query: string,
  accept: string
) {
  try {
    const upstream = await withPublicQueryTracking(runtime, query, (options) =>
      runtime.sparql.download(query, accept, options)
    )
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

async function withPublicQueryTracking<T>(
  runtime: WorkbenchRuntime,
  query: string,
  run: (options: SparqlRequestOptions) => Promise<T>
): Promise<T> {
  if (runtime.provider !== 'qlever') return run({})
  const queryId = crypto.randomUUID()
  registerQuery(queryId, PUBLIC_QUERY_OWNER, query)
  try {
    return await run({ queryId })
  } finally {
    unregisterQuery(queryId)
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
