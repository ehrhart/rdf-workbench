import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
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
              ...(abortController ? { signal: abortController.signal } : {})
            }
          : {}
      )
      return NextResponse.json(data, { status: 200 })
    } finally {
      if (registered && queryId) {
        if (runtime.provider === 'qlever') unregisterQleverQuery(queryId)
        else unregisterVirtuosoQuery(queryId)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    const status =
      error instanceof DOMException && error.name === 'AbortError' ? 504 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
