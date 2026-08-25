import { NextResponse } from 'next/server'
import { Parser } from 'sparqljs'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { SparqlQueryKind } from '@/lib/runtime/contracts'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import {
  registerQuery as registerQleverQuery,
  unregisterQuery as unregisterQleverQuery
} from '@/providers/qlever/query-registry'
import {
  registerQuery as registerVirtuosoQuery,
  unregisterQuery as unregisterVirtuosoQuery
} from '@/providers/virtuoso/query-registry'

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
    // Parse the body as the SPARQL query (application/sparql-query)
    const query = await request.text()

    if (!query) {
      return NextResponse.json(
        { error: 'No query provided in the request' },
        { status: 400 }
      )
    }

    const runtime = await getWorkbenchRuntime()

    let queryId: string | undefined
    let registered = false
    let abortController: AbortController | null = null
    const headerId = request.headers.get('x-query-id')
    if (headerId && UUID_PATTERN.test(headerId)) {
      queryId = headerId
      const principal = await runtime.auth.getPrincipal()
      if (runtime.provider === 'qlever') {
        registerQleverQuery(queryId, principal?.id ?? null, query)
      } else {
        abortController = new AbortController()
        registerVirtuosoQuery(queryId, principal?.id ?? null, query, () =>
          abortController?.abort()
        )
      }
      registered = true
    }

    try {
      const data = await runtime.sparql.execute(
        query,
        queryId
          ? {
              queryId,
              kind: detectQueryKind(query),
              ...(abortController ? { signal: abortController.signal } : {})
            }
          : { kind: detectQueryKind(query) }
      )
      return NextResponse.json(data, { status: 200 })
    } finally {
      if (registered && queryId) {
        if (runtime.provider === 'qlever') unregisterQleverQuery(queryId)
        else unregisterVirtuosoQuery(queryId)
      }
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
