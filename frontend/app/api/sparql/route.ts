import { NextResponse } from 'next/server'
import { Parser } from 'sparqljs'
import { unauthenticatedResponse } from '@/lib/api-auth'
import { registerQuery, unregisterQuery } from '@/lib/query-registry'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { SparqlQueryKind } from '@/lib/runtime/contracts'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function detectQueryKind(query: string): SparqlQueryKind {
  try {
    const parsed = new Parser({ skipUngroupedVariableCheck: true }).parse(query)
    if ('queryType' in parsed) {
      return parsed.queryType.toLowerCase() as SparqlQueryKind
    }
    if ('updates' in parsed) {
      return 'update'
    }
  } catch {
    // Ignore parsing errors
  }
  return 'unknown'
}

export async function POST(request: Request) {
  try {
    const query = await request.text()

    if (!query) {
      return NextResponse.json(
        { error: 'No query provided in the request' },
        { status: 400 }
      )
    }

    const runtime = await getWorkbenchRuntime()

    const kind = detectQueryKind(query)
    if (kind === 'update' && !isSameOriginMutation(request)) {
      return sameOriginError()
    }

    const principal = await runtime.auth.getPrincipal()
    const authenticated =
      principal !== null && !principal.mustChangePassword
    if (!authenticated && (kind === 'update' || kind === 'unknown')) {
      return unauthenticatedResponse()
    }

    const headerId = request.headers.get('x-query-id')
    const queryId =
      headerId && UUID_PATTERN.test(headerId) ? headerId : crypto.randomUUID()
    const controller = new AbortController()
    registerQuery(queryId, principal?.id ?? null, query, () =>
      controller.abort()
    )

    try {
      const data = await runtime.sparql.execute(query, {
        queryId,
        kind,
        signal: AbortSignal.any([request.signal, controller.signal])
      })
      return NextResponse.json(data, { status: 200 })
    } finally {
      unregisterQuery(queryId)
    }
  } catch (error) {
    const isTimeout = error instanceof SparqlTimeoutError
    const isAbort =
      !isTimeout && error instanceof DOMException && error.name === 'AbortError'
    const message = isTimeout
      ? error.message
      : isAbort
        ? 'Query aborted'
        : error instanceof Error
          ? error.message
          : 'Server error'
    const status = isTimeout ? 504 : isAbort ? 499 : 400
    const code = isTimeout ? 'timeout' : isAbort ? 'aborted' : 'error'
    return NextResponse.json({ error: message, code }, { status })
  }
}
