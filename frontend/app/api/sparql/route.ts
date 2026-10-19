import { NextResponse } from 'next/server'
import { unauthenticatedResponse } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { SparqlTimeoutError } from '@/lib/sparql/errors'
import { detectQueryKind } from '@/lib/sparql/kind'

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
    const authenticated = principal !== null && !principal.mustChangePassword
    if (!authenticated && (kind === 'update' || kind === 'unknown')) {
      return unauthenticatedResponse()
    }

    const data = await runtime.sparql.execute(query, {
      kind,
      ownerId: principal?.id ?? null,
      origin: 'api:sparql',
      signal: request.signal
    })
    return NextResponse.json(data, { status: 200 })
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
