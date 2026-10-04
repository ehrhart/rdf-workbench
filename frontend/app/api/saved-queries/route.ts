import { NextResponse } from 'next/server'
import { anonymousReadEnabled } from '@/config/access'
import { requirePrincipal, resolveOptionalViewer } from '@/lib/api-auth'
import { AuthError, ConnectionError, QueryError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const errorResponse = (error: unknown, hasSession: boolean) => {
  if (error instanceof ConnectionError) {
    return NextResponse.json(
      { error: 'Saved queries service is temporarily unavailable' },
      { status: 503 }
    )
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: hasSession ? 403 : 401 }
    )
  }

  if (error instanceof QueryError) {
    const status = /not found/i.test(error.message) ? 404 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  console.error('Unexpected saved queries API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while handling saved queries' },
    { status: 500 }
  )
}

async function listSavedQueries(
  viewerId: string | null,
  hasSession: boolean
): Promise<NextResponse> {
  try {
    const runtime = await getWorkbenchRuntime()
    const items = await runtime.savedQueries.list(viewerId)
    return NextResponse.json({ items })
  } catch (error) {
    return errorResponse(error, hasSession)
  }
}

export async function GET() {
  if (!anonymousReadEnabled()) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
    return listSavedQueries(auth.principal.id, true)
  }

  const viewer = await resolveOptionalViewer()
  if (viewer.response) return viewer.response
  return listSavedQueries(viewer.viewerId, false)
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required to save queries' },
      { status: 401 }
    )
  }

  try {
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.toString?.() ?? ''
    const query = payload?.query?.toString?.() ?? ''

    const saved = await runtime.savedQueries.create({ name, query }, session)

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    return errorResponse(error, true)
  }
}
