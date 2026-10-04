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

  console.error('Unexpected saved query API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while handling saved query' },
    { status: 500 }
  )
}

async function getSavedQuery(
  id: string,
  viewerId: string | null,
  hasSession: boolean
): Promise<NextResponse> {
  try {
    const runtime = await getWorkbenchRuntime()
    const saved = await runtime.savedQueries.get(id, viewerId)

    if (!saved) {
      return NextResponse.json(
        { error: 'Saved query not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(saved)
  } catch (error) {
    return errorResponse(error, hasSession)
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!anonymousReadEnabled()) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
    const { id } = await params
    return getSavedQuery(id, auth.principal.id, true)
  }

  const viewer = await resolveOptionalViewer()
  if (viewer.response) return viewer.response
  const { id } = await params
  return getSavedQuery(id, viewer.viewerId, false)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required to update saved queries' },
      { status: 401 }
    )
  }

  try {
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.toString?.() ?? ''
    const query = payload?.query?.toString?.() ?? ''

    const { id } = await params

    const updated = await runtime.savedQueries.update(
      id,
      { name, query },
      session
    )

    return NextResponse.json(updated)
  } catch (error) {
    return errorResponse(error, true)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required to delete saved queries' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    await runtime.savedQueries.delete(id, session)

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, true)
  }
}
