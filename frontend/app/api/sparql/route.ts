import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { detectSparqlQueryKind } from '@/lib/sparql/query-kind'
import {
  registerQuery,
  unregisterQuery
} from '@/providers/qlever/query-registry'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    if (
      runtime.provider === 'virtuoso' &&
      detectSparqlQueryKind(query) === 'update' &&
      !isSameOriginMutation(request)
    ) {
      return sameOriginError()
    }

    let queryId: string | undefined
    let registered = false
    if (runtime.provider === 'qlever') {
      const headerId = request.headers.get('x-query-id')
      if (headerId && UUID_PATTERN.test(headerId)) {
        queryId = headerId
        const principal = await runtime.auth.getPrincipal()
        registerQuery(queryId, principal?.id ?? null, query)
        registered = true
      }
    }

    try {
      const data = await runtime.sparql.execute(
        query,
        queryId ? { queryId } : {}
      )
      return NextResponse.json(data, { status: 200 })
    } finally {
      if (registered && queryId) unregisterQuery(queryId)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    const status =
      error instanceof Error && error.name === 'QleverReadOnlyError'
        ? 405
        : error instanceof DOMException && error.name === 'AbortError'
          ? 504
          : 400
    return NextResponse.json({ error: message }, { status })
  }
}
